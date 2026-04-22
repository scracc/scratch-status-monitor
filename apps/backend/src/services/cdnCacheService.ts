import { ssmrc } from "@repo/configs";
import type {
  HistoryResponse as HistoryResponseType,
  StatusResponse as StatusResponseType,
} from "@repo/types";

export const CACHE_NAMESPACE = "ssm-api";
const CACHE_TTL_SECONDS = Math.floor(ssmrc.cache.statusTtlMs / 1000);
const CRON_GRACE_MS = 2 * 60 * 1000;

export const buildCacheKey = (url: string) => new Request(url, { method: "GET" });

export const applyCacheHeaders = (response: Response, ttlSeconds?: number) => {
  const ttl = typeof ttlSeconds === "number" ? ttlSeconds : CACHE_TTL_SECONDS;
  response.headers.set(
    "Cache-Control",
    `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${ttl}`
  );
};

export const getCronAlignedTtlSeconds = (
  nowMs: number = Date.now(),
  intervalMs: number = ssmrc.cache.statusTtlMs,
  graceMs: number = CRON_GRACE_MS
): number => {
  const nextBoundary = Math.ceil(nowMs / intervalMs) * intervalMs;
  const expiresAt = nextBoundary + graceMs;
  const ttlMs = Math.max(0, expiresAt - nowMs);
  return Math.max(1, Math.floor(ttlMs / 1000));
};

export async function upsertStatusCdnCache(
  baseUrl: string,
  status: StatusResponseType
): Promise<void> {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const url = `${normalizedBaseUrl}/status`;

  const response = new Response(
    JSON.stringify({
      success: true,
      data: status,
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );

  applyCacheHeaders(response);

  const cache = await caches.open(CACHE_NAMESPACE);
  await cache.put(buildCacheKey(url), response);
}

export async function upsertHistoryCdnCache(
  baseUrl: string,
  histories: HistoryResponseType[],
  limit: number = 100,
  offset: number = 0
): Promise<void> {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const url = `${normalizedBaseUrl}/history?limit=${limit}&offset=${offset}`;

  const response = new Response(
    JSON.stringify({
      success: true,
      data: histories,
    }),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );

  applyCacheHeaders(response);

  const cache = await caches.open(CACHE_NAMESPACE);
  await cache.put(buildCacheKey(url), response);
}
