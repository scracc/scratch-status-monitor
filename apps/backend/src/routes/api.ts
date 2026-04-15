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
import {
  createManagedToken,
  listManagedTokens,
  revokeManagedTokenById,
  updateManagedTokenById,
} from "../services/tokenService";
import type { AuthTokenPrincipal } from "../types/auth";
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

const shouldBypassCache = (
  c: Context<{ Bindings: Env; Variables: { auth: AuthTokenPrincipal } }>
) => c.req.header("x-cache-bust") === "1" || c.req.query("cache-bust") === "1";

const managedTokenSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  tokenPrefix: z.string(),
  isActive: z.boolean(),
  isAdmin: z.boolean(),
  rateLimitPerMinute: z.number().int(),
  settings: z.record(z.string(), z.any()),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const createManagedTokenBodySchema = z.object({
  name: z.string().min(1).max(120),
  isAdmin: z.boolean().optional(),
  rateLimitPerMinute: z.number().int().min(1).max(60_000).optional(),
  settings: z.record(z.string(), z.any()).optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
});

const updateManagedTokenBodySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    isActive: z.boolean().optional(),
    isAdmin: z.boolean().optional(),
    rateLimitPerMinute: z.number().int().min(1).max(60_000).optional(),
    settings: z.record(z.string(), z.any()).optional(),
    expiresAt: z.iso.datetime().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "更新項目を1つ以上指定してください",
  });

/**
 * ルータ
 * ステータス・履歴・統計情報に関するエンドポイントを提供
 */
export const createApiRouter = () => {
  const router = new OpenAPIHono<{ Bindings: Env; Variables: { auth: AuthTokenPrincipal } }>();

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
    handler: (c: Context<{ Bindings: Env; Variables: { auth: AuthTokenPrincipal } }>) => Promise<T>
  ) => {
    return async (
      c: Context<{ Bindings: Env; Variables: { auth: AuthTokenPrincipal } }>
    ): Promise<T> => {
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

  const requireAdmin = (c: Context<{ Bindings: Env; Variables: { auth: AuthTokenPrincipal } }>) => {
    const auth = c.get("auth");
    if (!auth.isAdmin) {
      return c.json(
        {
          success: false,
          message: "admin 権限が必要です",
        },
        403
      );
    }

    return null;
  };

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

  const listTokensRoute = createRoute({
    method: "get",
    path: "/auth/tokens",
    tags: ["Auth"],
    summary: "管理トークンの一覧を取得",
    description: "管理対象 API トークンのメタデータを返します（生トークンは返しません）",
    responses: {
      403: {
        description: "管理権限がありません",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal(false),
              message: z.string(),
            }),
          },
        },
      },
      200: {
        description: "トークン一覧取得成功",
        content: {
          "application/json": {
            schema: successSchema.extend({
              data: z.array(managedTokenSchema),
            }),
          },
        },
      },
    },
  });

  router.openapi(listTokensRoute, async (c) => {
    const forbidden = requireAdmin(c);
    if (forbidden) {
      return forbidden;
    }

    const tokens = await listManagedTokens();
    return c.json({ success: true, data: tokens }, 200);
  });

  const createTokenRoute = createRoute({
    method: "post",
    path: "/auth/tokens",
    tags: ["Auth"],
    summary: "管理トークンを発行",
    description:
      "新しい API トークンを作成します（トークン文字列はこのレスポンスでのみ返されます）",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: createManagedTokenBodySchema,
          },
        },
      },
    },
    responses: {
      403: {
        description: "管理権限がありません",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal(false),
              message: z.string(),
            }),
          },
        },
      },
      201: {
        description: "トークン作成成功",
        content: {
          "application/json": {
            schema: successSchema.extend({
              data: z.object({
                token: z.string(),
                tokenInfo: managedTokenSchema,
              }),
            }),
          },
        },
      },
    },
  });

  router.openapi(createTokenRoute, async (c) => {
    const forbidden = requireAdmin(c);
    if (forbidden) {
      return forbidden;
    }

    const body = createManagedTokenBodySchema.parse(await c.req.json());
    const created = await createManagedToken(body);

    return c.json(
      {
        success: true,
        data: {
          token: created.token,
          tokenInfo: created.record,
        },
      },
      201
    );
  });

  const updateTokenRoute = createRoute({
    method: "patch",
    path: "/auth/tokens/{tokenId}",
    tags: ["Auth"],
    summary: "管理トークンを更新",
    description: "トークンごとの有効状態・管理権限・レート制限・設定を更新します",
    request: {
      params: z.object({
        tokenId: UUIDSchema,
      }),
      body: {
        required: true,
        content: {
          "application/json": {
            schema: updateManagedTokenBodySchema,
          },
        },
      },
    },
    responses: {
      403: {
        description: "管理権限がありません",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal(false),
              message: z.string(),
            }),
          },
        },
      },
      200: {
        description: "トークン更新成功",
        content: {
          "application/json": {
            schema: successSchema.extend({
              data: managedTokenSchema,
            }),
          },
        },
      },
    },
  });

  router.openapi(updateTokenRoute, async (c) => {
    const forbidden = requireAdmin(c);
    if (forbidden) {
      return forbidden;
    }

    const tokenId = UUIDSchema.parse(c.req.param("tokenId"));
    const body = updateManagedTokenBodySchema.parse(await c.req.json());
    const updated = await updateManagedTokenById(tokenId, body);

    return c.json(
      {
        success: true,
        data: updated,
      },
      200
    );
  });

  const revokeTokenRoute = createRoute({
    method: "delete",
    path: "/auth/tokens/{tokenId}",
    tags: ["Auth"],
    summary: "管理トークンを失効",
    description: "指定トークンを失効（isActive=false）します",
    request: {
      params: z.object({
        tokenId: UUIDSchema,
      }),
    },
    responses: {
      403: {
        description: "管理権限がありません",
        content: {
          "application/json": {
            schema: z.object({
              success: z.literal(false),
              message: z.string(),
            }),
          },
        },
      },
      200: {
        description: "トークン失効成功",
        content: {
          "application/json": {
            schema: successSchema.extend({
              data: managedTokenSchema,
            }),
          },
        },
      },
    },
  });

  router.openapi(revokeTokenRoute, async (c) => {
    const forbidden = requireAdmin(c);
    if (forbidden) {
      return forbidden;
    }

    const tokenId = UUIDSchema.parse(c.req.param("tokenId"));
    const revoked = await revokeManagedTokenById(tokenId);
    return c.json({ success: true, data: revoked }, 200);
  });

  return router;
};
