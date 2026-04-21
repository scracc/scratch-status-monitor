import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import {
  applyCacheHeaders,
  buildCacheKey,
  CACHE_NAMESPACE,
  getCronAlignedTtlSeconds,
} from "../services/cdnCacheService";
import { createLogger } from "../services/logger";
import type { AuthTokenPrincipal } from "../types/auth";
import type { Env } from "../types/env";
import { registerStatusRoutes } from "./status";
import { registerTokenRoutes } from "./token";

const logger = createLogger("API");

type AppSchema = { Bindings: Env; Variables: { auth: AuthTokenPrincipal } };

export type AppContext = Context<AppSchema>;
export type AppRouter = OpenAPIHono<AppSchema>;

const shouldBypassCache = (c: AppContext) =>
  c.req.header("x-cache-bust") === "1" || c.req.query("cache-bust") === "1";

export const successSchema = z.object({
  success: z.literal(true),
});

export const cacheableHandler = <T extends Response>(handler: (c: AppContext) => Promise<T>) => {
  return async (c: AppContext): Promise<T> => {
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

export const requireAdmin = (c: AppContext) => {
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

export const createApiRouter = () => {
  const router = new OpenAPIHono<AppSchema>();

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

  registerStatusRoutes(router);
  registerTokenRoutes(router);

  return router;
};
