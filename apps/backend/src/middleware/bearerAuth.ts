import type { Context, MiddlewareHandler } from "hono";
import { authenticateApiToken } from "../services/tokenService";
import type { AuthTokenPrincipal } from "../types/auth";
import type { Env } from "../types/env";

interface RateWindow {
  startedAt: number;
  count: number;
}

const RATE_WINDOW_MS = 60_000;
const rateWindows = new Map<string, RateWindow>();

function isBypassedPath(environment: Env["ENVIRONMENT"], path: string): boolean {
  if (environment !== "development") {
    return false;
  }

  const isTestRoute = path.startsWith("/test/");
  const isDebugRoute = path.startsWith("/debug/");
  const isDocsRoute = path === "/docs" || path.startsWith("/docs/") || path === "/openapi.json";
  const isRootRoute = path === "/";

  return isTestRoute || isDebugRoute || isDocsRoute || isRootRoute;
}

type AuthErrorStatus = 401 | 403 | 429 | 503;

function jsonError(c: Context, message: string, status: AuthErrorStatus): Response {
  return c.json(
    {
      success: false,
      message,
    },
    status
  );
}

function extractBearerToken(authorizationHeader?: string): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

function consumeRateLimit(tokenKey: string, limit: number) {
  const now = Date.now();
  const existing = rateWindows.get(tokenKey);

  if (!existing || now - existing.startedAt >= RATE_WINDOW_MS) {
    const next: RateWindow = { startedAt: now, count: 1 };
    rateWindows.set(tokenKey, next);
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetAt: next.startedAt + RATE_WINDOW_MS,
      retryAfter: 0,
    };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  const resetAt = existing.startedAt + RATE_WINDOW_MS;

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt,
    retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

function setRateLimitHeaders(c: Context, limit: number, remaining: number, resetAt: number): void {
  c.header("X-RateLimit-Limit", String(limit));
  c.header("X-RateLimit-Remaining", String(remaining));
  c.header("X-RateLimit-Reset", String(Math.floor(resetAt / 1000)));
}

/**
 * Bearer 認証ミドルウェア
 * 環境に応じて認証の適用範囲を変更
 *
 * 本番環境 (ENVIRONMENT=production):
 * - 全てのルートに認証を適用
 *
 * 開発環境 (ENVIRONMENT=development):
 * - テストルート (/test/*) は認証なし
 * - ドキュメントルート (/docs, /openapi.json) は認証なし
 * - その他のルートには認証を適用
 */
export function createBearerAuthMiddleware(): MiddlewareHandler<{
  Bindings: Env;
  Variables: { auth: AuthTokenPrincipal };
}> {
  return async (c: Context<{ Bindings: Env; Variables: { auth: AuthTokenPrincipal } }>, next) => {
    const environment = c.env.ENVIRONMENT || "development";
    if (isBypassedPath(environment, c.req.path)) {
      return next();
    }

    const rawToken = extractBearerToken(c.req.header("Authorization"));
    if (!rawToken) {
      return jsonError(c, "Bearer トークンが必要です", 401);
    }

    let principal: AuthTokenPrincipal | null = null;
    try {
      principal = await authenticateApiToken(rawToken, c.env);
    } catch (error) {
      console.error("Failed to authenticate token", error);
      return jsonError(c, "認証サービスに接続できません", 503);
    }

    if (!principal) {
      return jsonError(c, "無効または期限切れのトークンです", 401);
    }

    const tokenKey = principal.tokenId ?? "legacy";
    const rateLimit = consumeRateLimit(tokenKey, principal.rateLimitPerMinute);
    setRateLimitHeaders(c, rateLimit.limit, rateLimit.remaining, rateLimit.resetAt);

    if (!rateLimit.allowed) {
      c.header("Retry-After", String(rateLimit.retryAfter));
      return jsonError(c, "レート制限を超過しました", 429);
    }

    c.set("auth", principal);
    await next();
  };
}
