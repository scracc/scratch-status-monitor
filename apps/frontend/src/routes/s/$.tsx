import { ssmrc } from "@repo/configs";
import { logger } from "@scracc/tanstack-plugin-logger";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/s/$")({
  beforeLoad: ({ params }) => {
    const pathKey = params._splat || "";

    // 短縮URLマッピングから URL を検索
    const mapping = ssmrc.shortUrls.find((item) => item.key === pathKey);

    if (!mapping) {
      // マッピングが見つからない場合、ホームへリダイレクト
      logger(
        {
          level: "warn",
          name: "ShortURL",
        },
        `Short URL not found: ${pathKey}`
      );
      const redirectPath = `/${pathKey}`;
      throw redirect({
        to: redirectPath,
        replace: true,
      });
    }
    // マッピングが見つかった場合、その URL へリダイレクト
    throw redirect({
      href: mapping.url,
      replace: true,
    });
  },
});
