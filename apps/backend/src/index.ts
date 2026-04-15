import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { showRoutes } from "hono/dev";
import { createBearerAuthMiddleware } from "./middleware/bearerAuth";
import { errorHandler } from "./middleware/errorHandler";
import mainMiddleware from "./middleware/main";
import { createApiRouter } from "./routes/api";
import { initializeCacheService } from "./services/cacheService";
import { runCleanup } from "./services/cleanupService";
import { initializeHistoryService } from "./services/historyService";
import { createLogger } from "./services/logger";
import { checkAllMonitors } from "./services/monitorService";
import { initializeSupabaseClient } from "./services/supabaseClient";
import type { AuthTokenPrincipal } from "./types/auth";
import type { Env } from "./types/env";

const logger = createLogger("Cron");

/**
 * Cloudflare Workers ScheduledEvent 型
 */
interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthTokenPrincipal } }>();

let servicesInitialized = false;

function ensureServices(env: Env): void {
  if (servicesInitialized) {
    return;
  }

  const supabase = initializeSupabaseClient(env);
  initializeCacheService(supabase);
  initializeHistoryService(supabase);
  servicesInitialized = true;
}

// Supabase クライアントと各サービスを初期化
// 注意: isolateスコープで1回だけ実行されます（リクエストごとではない）
app.use("*", async (c, next) => {
  ensureServices(c.env);
  await next();
});

app.use("*", errorHandler());
app.route("*", mainMiddleware);

// Bearer 認証を適用（環境に応じて適用範囲が変わります）
app.use("*", createBearerAuthMiddleware());

// API ルータを先に作成してメタデータを登録
// (OpenAPI スキーマ生成の前に実行される必要があります)
const apiRouter = createApiRouter();
app.route("", apiRouter);

app.get(
  "/docs",
  Scalar({
    url: "/openapi.json",
    pageTitle: "Scratch Status Monitor API",
    _integration: "hono",
    hideClientButton: true,
    authentication: {
      preferredSecurityScheme: ["HTTP Bearer"],
      securitySchemes: {
        "HTTP Bearer": {
          type: "http",
          scheme: "bearer",
          token: "your-secret-token-here",
        },
      },
    },
  })
);

app.get("/", (c) => {
  return c.json({
    message: "Scratch Status Monitor API",
    version: "1.0.0",
    docs: "/docs",
    openapi: "/openapi.json",
  });
});

showRoutes(app, {
  verbose: true,
});

/**
 * Cron Trigger ハンドラー
 * v2.0: 全モニターをチェックし、Supabase に保存
 */
async function handleCron(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
  try {
    const startTime = Date.now();
    logger.info("Scheduled task started");

    ensureServices(env);

    // 1. 全モニターをチェック
    const result = await checkAllMonitors();
    logger.info("Monitor check completed", {
      overallStatus: result.overallStatus,
    });

    // 2. クリーンアップを実行（古いデータを削除）
    await runCleanup();

    const endTime = Date.now();
    logger.info(`Scheduled task completed. ${endTime - startTime}ms`);
  } catch (error) {
    logger.error("Error during scheduled tasks", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export default {
  fetch: app.fetch,
  scheduled: handleCron,
};
