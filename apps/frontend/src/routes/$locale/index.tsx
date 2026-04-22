import { ssmrc } from "@repo/configs";
import { logger } from "@scracc/tanstack-plugin-logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { StatusPageProvider } from "@/components/common/status/layout/context";
import { InfoHeader } from "@/components/common/status/layout/info-header";
import { Monitors } from "@/components/common/status/layout/monitors";
import { StatusPageSkeleton } from "@/components/common/status/layout/skeleton";
import { Callout } from "@/components/markdown/components/callout";
import { STATUS_PAGE_QUERY_KEY } from "@/lib/status-page/config";
// Local imports
import { getCachedHistories } from "@/lib/status-page/server";
import {
  closeBroadcastChannel,
  initializeBroadcastChannel,
  refetchAndBroadcast,
} from "@/lib/status-page/sync";
import type { StatusPageLoaderData } from "@/lib/status-page/types";
import { buildHreflangLinks } from "@/seo/hreflang";
import { seo } from "@/seo/seo";
import { GiscusWidget } from "@/utils/giscus";
import { scrollToTop } from "@/utils/onenter.scrollTo";

const DEFAULT_LOADER_DATA: StatusPageLoaderData = {
  histories: [],
  nextRefreshAt: Date.now(),
  refreshIntervalMs: ssmrc.cache.statusTtlMs,
};

export const Route = createFileRoute("/$locale/")({
  loader: async () => {
    try {
      return await getCachedHistories();
    } catch (error) {
      logger(
        {
          level: "error",
          name: "StatusPageLoader",
        },
        "Failed to load status page data:",
        error
      );
      // デフォルトデータを返してアプリを続行
      return DEFAULT_LOADER_DATA;
    }
  },
  head: ({ params }) => {
    const { locale } = params;
    return {
      meta: seo(locale),
      links: buildHreflangLinks({ locale, path: "/" }),
    };
  },
  component: App,
  onEnter: scrollToTop,
});

function App() {
  const loaderData = Route.useLoaderData();
  const queryClient = useQueryClient();

  // BroadcastChannel を初期化
  useEffect(() => {
    initializeBroadcastChannel(queryClient);

    return () => {
      closeBroadcastChannel();
    };
  }, [queryClient]);

  const { data, isPending, error } = useQuery({
    queryKey: STATUS_PAGE_QUERY_KEY,
    queryFn: refetchAndBroadcast,
    staleTime: ssmrc.cache.statusTtlMs,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    initialData: loaderData,
  });

  const nextRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skippedRefreshRef = useRef(false);

  useEffect(() => {
    if (!data?.nextRefreshAt) {
      return undefined;
    }

    const scheduleNext = (delayMs: number) => {
      if (nextRefreshTimeoutRef.current) {
        clearTimeout(nextRefreshTimeoutRef.current);
      }

      nextRefreshTimeoutRef.current = setTimeout(() => {
        const isHidden = typeof document !== "undefined" && document.visibilityState === "hidden";
        if (isHidden) {
          skippedRefreshRef.current = true;
          scheduleNext(ssmrc.cache.statusTtlMs);
          return;
        }

        skippedRefreshRef.current = false;
        queryClient.refetchQueries({ queryKey: STATUS_PAGE_QUERY_KEY, exact: true });
        scheduleNext(ssmrc.cache.statusTtlMs);
      }, delayMs);
    };

    const now = Date.now();
    const initialDelay = Math.max(0, data.nextRefreshAt - now);
    scheduleNext(initialDelay);

    return () => {
      if (nextRefreshTimeoutRef.current) {
        clearTimeout(nextRefreshTimeoutRef.current);
        nextRefreshTimeoutRef.current = null;
      }
    };
  }, [data?.nextRefreshAt, queryClient]);

  useEffect(() => {
    const handleVisibility = () => {
      if (typeof document === "undefined") {
        return;
      }
      if (document.visibilityState !== "visible") {
        return;
      }

      if (skippedRefreshRef.current) {
        toast("タブがフォーカスされていないため自動更新をスキップしました");
        skippedRefreshRef.current = false;
      }

      queryClient.refetchQueries({ queryKey: STATUS_PAGE_QUERY_KEY, exact: true });
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [queryClient]);

  if (isPending) {
    return <StatusPageSkeleton />;
  }

  const { histories, nextRefreshAt, refreshIntervalMs } = data;

  return (
    <StatusPageProvider
      histories={histories}
      nextRefreshAt={nextRefreshAt}
      refreshIntervalMs={refreshIntervalMs}
    >
      <div className="max-w-3xl p-4 lg:py-8 mx-auto">
        {/* エラーアラート */}
        {error && (
          <Callout variant="error" title="重要なお知らせ" className="my-5">
            {error instanceof Error ? error.message : "履歴データの取得に失敗しました"}
          </Callout>
        )}

        <InfoHeader />
        <Monitors />

        <GiscusWidget />
      </div>
    </StatusPageProvider>
  );
}
