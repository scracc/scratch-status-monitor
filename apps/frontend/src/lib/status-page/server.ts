import { ssmrc } from "@repo/configs";
import { logger } from "@scracc/tanstack-plugin-logger";
import { createServerFn } from "@tanstack/react-start";
import { getEnv } from "@/plugins/envrc";
import type { HistoryApiEnvelope, StatusPageLoaderData } from "./types";

const FETCH_TIMEOUT_MS = 30000; // 20秒
const CRON_GRACE_MS = 2 * 60 * 1000;

const getAlignedRefreshTiming = (
  nowMs: number = Date.now(),
  intervalMs: number = ssmrc.cache.statusTtlMs,
  graceMs: number = CRON_GRACE_MS
): { nextRefreshAt: number; refreshIntervalMs: number } => {
  const nextBoundary = Math.ceil(nowMs / intervalMs) * intervalMs;
  const alignedBoundary = nextBoundary === nowMs ? nextBoundary + intervalMs : nextBoundary;
  const nextRefreshAt = alignedBoundary + graceMs;
  const refreshIntervalMs = Math.max(1000, nextRefreshAt - nowMs);
  return { nextRefreshAt, refreshIntervalMs };
};

/**
 * Server Function: サーバーサイドでバックエンドAPIから履歴データ取得（段階的）
 */
const fetchHistoriesServerFn = createServerFn({ method: "GET" })
  .inputValidator((data?: { limit?: number; offset?: number }) => data ?? {})
  .handler(async ({ data }): Promise<StatusPageLoaderData> => {
    const env = getEnv();
    const { VITE_BACKEND_URL: baseUrl, API_TOKEN } = env;

    const limit = data?.limit ?? 1000;
    const offset = data?.offset ?? 0;

    const url = `${baseUrl}/history?limit=${limit}&offset=${offset}`;

    logger(
      {
        level: "info",
        name: "Histories",
      },
      "Request start:",
      url
    );

    const startTime = performance.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const historyResponse = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${API_TOKEN}`,
        },
      });

      const elapsed = performance.now() - startTime;

      logger(
        {
          level: "info",
          name: "Histories",
        },
        "Response received:",
        `${elapsed.toFixed(2)}ms`
      );

      if (!historyResponse.ok) {
        let errorMessage = `HTTPエラー: ${historyResponse.status} ${historyResponse.statusText}`;
        try {
          const errorBody = await historyResponse.text();
          if (errorBody) {
            errorMessage += `\nレスポンス本体: ${errorBody}`;
          }
        } catch {
          // レスポンス読み込み失敗は無視
        }

        logger(
          {
            level: "error",
            name: "Histories",
          },
          "Failed to fetch histories:",
          {
            status: historyResponse.status,
            statusText: historyResponse.statusText,
            url: historyResponse.url,
            elapsed: `${elapsed.toFixed(2)}ms`,
            headers: Object.fromEntries(historyResponse.headers.entries()),
            message: errorMessage,
          }
        );

        throw new Error(errorMessage);
      }

      const historyJson = (await historyResponse.json()) as HistoryApiEnvelope;

      logger(
        {
          level: "info",
          name: "Histories",
        },
        "Data parsed:",
        JSON.stringify({
          recordCount: historyJson.data?.length ?? 0,
          elapsed: `${elapsed.toFixed(2)}ms`,
        })
      );

      const { nextRefreshAt, refreshIntervalMs } = getAlignedRefreshTiming();

      return {
        histories: historyJson.data,
        nextRefreshAt,
        refreshIntervalMs,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      const elapsed = performance.now() - startTime;

      if (error instanceof DOMException && error.name === "AbortError") {
        const message = `Timeout after ${FETCH_TIMEOUT_MS}ms while fetching ${url}`;
        logger(
          {
            level: "error",
            name: "Histories",
          },
          message,
          `${elapsed.toFixed(2)}ms`
        );
        throw new Error(
          `バックエンドが応答しません (タイムアウト: ${(FETCH_TIMEOUT_MS / 1000).toFixed(0)}秒)。バックエンドのCPU使用率を確認してください。`
        );
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  });

export const fetchHistories = async (params?: {
  limit?: number;
  offset?: number;
}): Promise<StatusPageLoaderData> => {
  return fetchHistoriesServerFn({ data: params });
};

/**
 * すべての履歴データを取得（hasMore が false になるまで繰り返し取得）
 */
export const fetchAllHistories = async (): Promise<StatusPageLoaderData> => {
  const PAGE_SIZE = 1000;
  let offset = 0;
  const historiesMap = new Map<string, StatusPageLoaderData["histories"][number]>();
  let hasMore = true;

  while (hasMore) {
    const result = await fetchHistories({ limit: PAGE_SIZE, offset });

    // モニターIDごとにレコードをマージ
    for (const history of result.histories) {
      const existing = historiesMap.get(history.monitorId);
      if (existing) {
        // 既存のレコードに新しいレコードを追加
        existing.records.push(...history.records);
        existing.hasMore = history.hasMore;
        // 統計情報も更新（最新のものを使用）
        existing.stats = history.stats;
        existing.totalRecords = history.totalRecords;
        existing.oldestRecord = history.oldestRecord;
        existing.newestRecord = history.newestRecord;
      } else {
        historiesMap.set(history.monitorId, history);
      }
    }

    // すべてのモニターで hasMore が false なら終了
    hasMore = Array.from(historiesMap.values()).some((h) => h.hasMore);
    offset += PAGE_SIZE;

    // 安全装置：最大10ページまで
    if (offset >= PAGE_SIZE * 20) {
      logger(
        {
          level: "warn",
          name: "Histories",
        },
        "Maximum page limit reached (20 pages)"
      );
      break;
    }
  }

  // モニターごとにレコードを重複排除・ソートして整形
  for (const history of historiesMap.values()) {
    const seen = new Set<string>();
    const deduped = history.records.filter((record) => {
      if (seen.has(record.id)) {
        return false;
      }
      seen.add(record.id);
      return true;
    });

    deduped.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

    history.records = deduped;
    history.oldestRecord = deduped[0]?.recordedAt;
    history.newestRecord = deduped[deduped.length - 1]?.recordedAt;
  }

  const { nextRefreshAt, refreshIntervalMs } = getAlignedRefreshTiming();

  return {
    histories: Array.from(historiesMap.values()),
    nextRefreshAt,
    refreshIntervalMs,
  };
};

// サーバーサイドのメモリキャッシュ（複数リクエスト間で共有）
let cachedLoaderData: StatusPageLoaderData | null = null;
let inFlightRequest: Promise<StatusPageLoaderData> | null = null;
let cacheExpireTime: number = 0;

/**
 * SSRローダー用：サーバーサイドのメモリキャッシュを優先的に使用
 */
export const getCachedHistories = async (): Promise<StatusPageLoaderData> => {
  const now = Date.now();

  // キャッシュが有効な場合はそれを返す
  if (cachedLoaderData && now < cacheExpireTime) {
    return cachedLoaderData;
  }

  // 既に取得中の場合は待機
  if (inFlightRequest) {
    return inFlightRequest;
  }

  // バックエンドから全データ取得
  inFlightRequest = fetchAllHistories()
    .then((data) => {
      cachedLoaderData = data;
      cacheExpireTime = now + data.refreshIntervalMs;
      inFlightRequest = null;
      return data;
    })
    .catch((error) => {
      inFlightRequest = null;
      throw error;
    });

  return inFlightRequest;
};

const fetchCachedHistoriesServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<StatusPageLoaderData> => getCachedHistories()
);

export const fetchCachedHistories = async (): Promise<StatusPageLoaderData> => {
  return fetchCachedHistoriesServerFn();
};
