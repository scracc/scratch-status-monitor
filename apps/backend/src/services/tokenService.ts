import { and, desc, eq } from "drizzle-orm";
import { withDb } from "../db/client";
import { type ApiToken, apiTokens } from "../db/schema";
import type {
  AuthTokenPrincipal,
  CreateManagedTokenInput,
  ManagedTokenRecord,
  UpdateManagedTokenInput,
} from "../types/auth";
import type { Env } from "../types/env";

const LEGACY_TOKEN_NAME = "legacy-env-token";
const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
const LEGACY_TOKEN_RATE_LIMIT = 60_000; // 環境変数トークンは無制限（分単位の最大値）
const TOKEN_SECRET_BYTES = 32;
const TOKEN_PREFIX_LENGTH = 12;

function toTokenSettings(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toManagedTokenRecord(row: ApiToken): ManagedTokenRecord {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    isActive: row.isActive,
    isAdmin: row.isAdmin,
    rateLimitPerMinute: row.rateLimitPerMinute,
    settings: toTokenSettings(row.settings),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function hashToken(rawToken: string): Promise<string> {
  const data = new TextEncoder().encode(rawToken);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
}

export function generateRawToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_SECRET_BYTES));
  return `ssm_${toBase64Url(bytes)}`;
}

function tokenPrefix(token: string): string {
  return token.slice(0, TOKEN_PREFIX_LENGTH);
}

export async function authenticateApiToken(
  rawToken: string,
  env: Env
): Promise<AuthTokenPrincipal | null> {
  const legacyToken = env.API_TOKEN;

  // 環境変数 API_TOKEN が設定されている場合、最高権限として認証する
  // これはブートストラップ・緊急アクセス用のトークンとして機能
  if (legacyToken && rawToken === legacyToken) {
    return {
      source: "legacy",
      tokenId: null,
      name: LEGACY_TOKEN_NAME,
      isAdmin: true,
      rateLimitPerMinute: LEGACY_TOKEN_RATE_LIMIT,
      settings: {},
    };
  }

  const hashedToken = await hashToken(rawToken);
  const data = await withDb((db) =>
    db.query.apiTokens.findFirst({
      where: and(eq(apiTokens.tokenHash, hashedToken), eq(apiTokens.isActive, true)),
    })
  );

  if (!data) {
    return null;
  }

  if (data.expiresAt && data.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  await withDb((db) =>
    db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, data.id))
  );

  return {
    source: "managed",
    tokenId: data.id,
    name: data.name,
    isAdmin: data.isAdmin,
    rateLimitPerMinute: data.rateLimitPerMinute,
    settings: toTokenSettings(data.settings),
  };
}

export async function listManagedTokens(): Promise<ManagedTokenRecord[]> {
  const rows = await withDb((db) => db.select().from(apiTokens).orderBy(desc(apiTokens.createdAt)));
  return rows.map(toManagedTokenRecord);
}

export async function createManagedToken(
  input: CreateManagedTokenInput
): Promise<{ token: string; record: ManagedTokenRecord }> {
  const rawToken = generateRawToken();
  const hashedToken = await hashToken(rawToken);
  const payload = {
    name: input.name,
    tokenHash: hashedToken,
    tokenPrefix: tokenPrefix(rawToken),
    isActive: true,
    isAdmin: input.isAdmin ?? false,
    rateLimitPerMinute: input.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
    settings: input.settings ?? {},
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  };

  const rows = await withDb((db) => db.insert(apiTokens).values(payload).returning());
  const created = rows[0];
  if (!created) {
    throw new Error("トークン作成に失敗しました");
  }

  return {
    token: rawToken,
    record: toManagedTokenRecord(created),
  };
}

export async function updateManagedTokenById(
  tokenId: string,
  input: UpdateManagedTokenInput
): Promise<ManagedTokenRecord> {
  const payload: Partial<ApiToken> = {};

  if (input.name !== undefined) {
    payload.name = input.name;
  }

  if (input.isActive !== undefined) {
    payload.isActive = input.isActive;
  }

  if (input.isAdmin !== undefined) {
    payload.isAdmin = input.isAdmin;
  }

  if (input.rateLimitPerMinute !== undefined) {
    payload.rateLimitPerMinute = input.rateLimitPerMinute;
  }

  if (input.settings !== undefined) {
    payload.settings = input.settings;
  }

  if (input.expiresAt !== undefined) {
    payload.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  }

  const rows = await withDb((db) =>
    db.update(apiTokens).set(payload).where(eq(apiTokens.id, tokenId)).returning()
  );
  const updated = rows[0];
  if (!updated) {
    throw new Error("トークンが見つかりません");
  }

  return toManagedTokenRecord(updated);
}

export async function revokeManagedTokenById(tokenId: string): Promise<ManagedTokenRecord> {
  return updateManagedTokenById(tokenId, { isActive: false });
}
