import type {
  AuthTokenPrincipal,
  CreateManagedTokenInput,
  ManagedTokenRecord,
  UpdateManagedTokenInput,
} from "../types/auth";
import type { Env } from "../types/env";
import { getSupabaseClient } from "./supabaseClient";

const LEGACY_TOKEN_NAME = "legacy-env-token";
const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
const LEGACY_TOKEN_RATE_LIMIT = 60_000; // 環境変数トークンは無制限（分単位の最大値）
const TOKEN_SECRET_BYTES = 32;
const TOKEN_PREFIX_LENGTH = 12;

type ApiTokenRow = {
  id: string;
  name: string;
  token_hash: string;
  token_prefix: string;
  is_active: boolean;
  is_admin: boolean;
  rate_limit_per_minute: number;
  settings: Record<string, unknown> | null;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function toManagedTokenRecord(row: ApiTokenRow): ManagedTokenRecord {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    isActive: row.is_active,
    isAdmin: row.is_admin,
    rateLimitPerMinute: row.rate_limit_per_minute,
    settings: row.settings ?? {},
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("api_tokens")
    .select(
      "id, name, token_hash, token_prefix, is_active, is_admin, rate_limit_per_minute, settings, last_used_at, expires_at, created_at, updated_at"
    )
    .eq("token_hash", hashedToken)
    .eq("is_active", true)
    .maybeSingle<ApiTokenRow>();

  if (error) {
    throw new Error(`トークン検証に失敗しました: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    return null;
  }

  await supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    source: "managed",
    tokenId: data.id,
    name: data.name,
    isAdmin: data.is_admin,
    rateLimitPerMinute: data.rate_limit_per_minute,
    settings: data.settings ?? {},
  };
}

export async function listManagedTokens(): Promise<ManagedTokenRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("api_tokens")
    .select(
      "id, name, token_hash, token_prefix, is_active, is_admin, rate_limit_per_minute, settings, last_used_at, expires_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .returns<ApiTokenRow[]>();

  if (error) {
    throw new Error(`トークン一覧取得に失敗しました: ${error.message}`);
  }

  return (data ?? []).map(toManagedTokenRecord);
}

export async function createManagedToken(
  input: CreateManagedTokenInput
): Promise<{ token: string; record: ManagedTokenRecord }> {
  const rawToken = generateRawToken();
  const hashedToken = await hashToken(rawToken);
  const supabase = getSupabaseClient();

  const payload = {
    name: input.name,
    token_hash: hashedToken,
    token_prefix: tokenPrefix(rawToken),
    is_active: true,
    is_admin: input.isAdmin ?? false,
    rate_limit_per_minute: input.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
    settings: input.settings ?? {},
    expires_at: input.expiresAt ?? null,
  };

  const { data, error } = await supabase
    .from("api_tokens")
    .insert(payload)
    .select(
      "id, name, token_hash, token_prefix, is_active, is_admin, rate_limit_per_minute, settings, last_used_at, expires_at, created_at, updated_at"
    )
    .single<ApiTokenRow>();

  if (error) {
    throw new Error(`トークン作成に失敗しました: ${error.message}`);
  }

  return {
    token: rawToken,
    record: toManagedTokenRecord(data),
  };
}

export async function updateManagedTokenById(
  tokenId: string,
  input: UpdateManagedTokenInput
): Promise<ManagedTokenRecord> {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) {
    payload.name = input.name;
  }

  if (input.isActive !== undefined) {
    payload.is_active = input.isActive;
  }

  if (input.isAdmin !== undefined) {
    payload.is_admin = input.isAdmin;
  }

  if (input.rateLimitPerMinute !== undefined) {
    payload.rate_limit_per_minute = input.rateLimitPerMinute;
  }

  if (input.settings !== undefined) {
    payload.settings = input.settings;
  }

  if (input.expiresAt !== undefined) {
    payload.expires_at = input.expiresAt;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("api_tokens")
    .update(payload)
    .eq("id", tokenId)
    .select(
      "id, name, token_hash, token_prefix, is_active, is_admin, rate_limit_per_minute, settings, last_used_at, expires_at, created_at, updated_at"
    )
    .single<ApiTokenRow>();

  if (error) {
    throw new Error(`トークン更新に失敗しました: ${error.message}`);
  }

  return toManagedTokenRecord(data);
}

export async function revokeManagedTokenById(tokenId: string): Promise<ManagedTokenRecord> {
  return updateManagedTokenById(tokenId, { isActive: false });
}
