import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import {
  getAllMonitorsHistoryHandler,
  getMonitorHistoryHandler,
  getMonitorStatsHandler,
} from "../procedures/history";
import { getStatusHandler } from "../procedures/status";
import {
  applyCacheHeaders,
  buildCacheKey,
  CACHE_NAMESPACE,
  getCronAlignedTtlSeconds,
} from "../services/cdnCacheService";
import { createLogger } from "../services/logger";
import type { Env } from "../types/env";
import { UUIDSchema } from "../utils/validators";

const logger = createLogger("API");
const monitorIdSchema = UUIDSchema;
const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
const statsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

const shouldBypassCache = (c: Context<{ Bindings: Env }>) =>
  c.req.header("x-cache-bust") === "1" || c.req.query("cache-bust") === "1";

/**
 * ルータ
 * ステータス・履歴・統計情報に関するエンドポイントを提供
 */
export const createApiRouter = () => {
  const router = new OpenAPIHono<{ Bindings: Env }>();

  router.doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
      title: "Scratch Status Monitor API",
      version: "1.0.0",
      description: "Scratchサービスの稼働状況を監視するAPI",
    },
    servers: [
      {
        url: "/",
        description: "開発環境",
      },
      {
        url: "https://api.ssm.scra.cc/",
        description: "本番環境",
      },
    ],
  });

  const _cacheableHandler = <T extends Response>(
    handler: (c: Context<{ Bindings: Env }>) => Promise<T>
  ) => {
    return async (c: Context<{ Bindings: Env }>): Promise<T> => {
      const isBypass = shouldBypassCache(c);
      const cache = await caches.open(CACHE_NAMESPACE);

      if (!isBypass) {
        const cacheKey = buildCacheKey(c.req.url);
        const cached = await cache.match(cacheKey);
        if (cached) {
          logger.info("CACHE HIT", { url: c.req.url });
          return cached as T;
        }
        logger.info("CACHE MISS", { url: c.req.url });
      } else {
        logger.info("CACHE BYPASS", { url: c.req.url });
      }

      const response = await handler(c);
      const ttlSeconds = getCronAlignedTtlSeconds();
      applyCacheHeaders(response, ttlSeconds);

      const cacheKey = buildCacheKey(c.req.url);
      logger.info("CACHE WRITE", {
        url: c.req.url,
        status: response.status,
        ttlSeconds,
      });
      await cache.put(cacheKey, response.clone());
      return response;
    };
  };

  const successSchema = z.object({
    success: z.literal(true),
  });

  const statusRoute = createRoute({
    method: "get",
    path: "/status",
    tags: ["Status"],
    summary: "現在のステータスを取得",
    description: "全モニターの最新ステータスを取得します（キャッシュ対応）",
    responses: {
      200: {
        description: "ステータス取得成功",
        content: {
          "application/json": {
            schema: successSchema.extend({
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  router.openapi(
    statusRoute,
    _cacheableHandler(async (c) => {
      const status = await getStatusHandler();
      return c.json(
        {
          success: true,
          data: status,
        },
        200
      );
    })
  );

  const historyRoute = createRoute({
    method: "get",
    path: "/history",
    tags: ["History"],
    summary: "全モニターの履歴を取得",
    description: "全てのモニターの履歴を取得します（ページング対応）",
    request: {
      query: historyQuerySchema,
    },
    responses: {
      200: {
        description: "履歴取得成功",
        content: {
          "application/json": {
            schema: successSchema.extend({
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  router.openapi(
    historyRoute,
    _cacheableHandler(async (c) => {
      const { limit, offset } = historyQuerySchema.parse({
        limit: c.req.query("limit"),
        offset: c.req.query("offset"),
      });

      const histories = await getAllMonitorsHistoryHandler({ limit, offset });
      return c.json(
        {
          success: true,
          data: histories,
        },
        200
      );
    })
  );

  const historyByMonitorRoute = createRoute({
    method: "get",
    path: "/history/{monitorId}",
    tags: ["History"],
    summary: "特定のモニターの履歴を取得",
    description: "指定されたモニターの詳細な履歴を取得します（ページング対応）",
    request: {
      params: z.object({
        monitorId: monitorIdSchema,
      }),
      query: historyQuerySchema,
    },
    responses: {
      200: {
        description: "履歴取得成功",
        content: {
          "application/json": {
            schema: successSchema.extend({
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  router.openapi(
    historyByMonitorRoute,
    _cacheableHandler(async (c) => {
      const monitorId = monitorIdSchema.parse(c.req.param("monitorId"));
      const { limit, offset } = historyQuerySchema.parse({
        limit: c.req.query("limit"),
        offset: c.req.query("offset"),
      });

      const history = await getMonitorHistoryHandler({
        monitorId,
        limit,
        offset,
      });

      return c.json(
        {
          success: true,
          data: history,
        },
        200
      );
    })
  );

  const statsRoute = createRoute({
    method: "get",
    path: "/stats/{monitorId}",
    tags: ["Monitors"],
    summary: "モニターの統計情報を取得",
    description: "指定されたモニターの稼働率と平均応答時間を取得します",
    request: {
      params: z.object({
        monitorId: monitorIdSchema,
      }),
      query: statsQuerySchema,
    },
    responses: {
      200: {
        description: "統計情報取得成功",
        content: {
          "application/json": {
            schema: successSchema.extend({
              data: z.any(),
            }),
          },
        },
      },
    },
  });

  router.openapi(
    statsRoute,
    _cacheableHandler(async (c) => {
      const monitorId = monitorIdSchema.parse(c.req.param("monitorId"));
      const { limit } = statsQuerySchema.parse({
        limit: c.req.query("limit"),
      });

      const stats = await getMonitorStatsHandler({
        monitorId,
        limit,
      });

      return c.json(
        {
          success: true,
          data: stats,
        },
        200
      );
    })
  );

  return router;
};
