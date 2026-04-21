import { createRoute, z } from "@hono/zod-openapi";
import {
  getAllMonitorsHistoryHandler,
  getMonitorHistoryHandler,
  getMonitorStatsHandler,
} from "../procedures/history";
import { getStatusHandler } from "../procedures/status";
import { UUIDSchema } from "../utils/validators";
import { type AppRouter, cacheableHandler, successSchema } from "./core";

const monitorIdSchema = UUIDSchema;
const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
const statsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export const registerStatusRoutes = (router: AppRouter) => {
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
    cacheableHandler(async (c) => {
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
    cacheableHandler(async (c) => {
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
    cacheableHandler(async (c) => {
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
    cacheableHandler(async (c) => {
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
};
