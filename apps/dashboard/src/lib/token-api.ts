import type {
  ManagedTokenRecord,
  CreateManagedTokenInput as SharedCreateManagedTokenInput,
  UpdateManagedTokenInput as SharedUpdateManagedTokenInput,
} from "@scracc/ssm-types";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * トークン関連 API の型エイリアス
 * 内部用としてシンプルな名前で再エクスポート
 */
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

export type ManagedToken = Omit<ManagedTokenRecord, "settings"> & {
  settings: Record<string, JsonValue>;
};

export type CreateManagedTokenInput = Omit<SharedCreateManagedTokenInput, "settings"> & {
  settings?: Record<string, JsonValue>;
};

export type UpdateManagedTokenInput = Omit<SharedUpdateManagedTokenInput, "settings"> & {
  settings?: Record<string, JsonValue>;
};

interface ApiErrorShape {
  success?: false;
  message?: string;
}

interface ApiSuccessShape<T> {
  success: true;
  data: T;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiClientContext {
  baseUrl: string;
  bearerToken: string;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function buildPath(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

async function requestJson<T>(
  context: ApiClientContext,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(buildPath(context.baseUrl, path), {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${context.bearerToken}`,
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => null)) as
    | ApiErrorShape
    | ApiSuccessShape<T>
    | null;

  if (!response.ok) {
    const errorMessage =
      (data && "message" in data ? data.message : null) ?? `API error: ${response.status}`;
    throw new ApiError(errorMessage, response.status);
  }

  if (!data || !("success" in data) || data.success !== true) {
    throw new ApiError("不正な API レスポンスを受信しました", response.status);
  }

  return data.data;
}

const ListTokensInputSchema = z.object({
  baseUrl: z.string().url(),
  bearerToken: z.string().min(1),
});

export const listManagedTokens = createServerFn({ method: "POST" })
  .inputValidator((data) => ListTokensInputSchema.parse(data))
  .handler(async ({ data: { baseUrl, bearerToken } }) => {
    return requestJson<ManagedToken[]>({ baseUrl, bearerToken }, "/auth/tokens", { method: "GET" });
  });

const CreateTokenInputSchema = z.object({
  baseUrl: z.string().url(),
  bearerToken: z.string().min(1),
  input: z.object({
    name: z.string().min(1),
    isAdmin: z.boolean().optional(),
    rateLimitPerMinute: z.number().int().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    expiresAt: z.string().nullable().optional(),
  }),
});

export const createManagedToken = createServerFn({ method: "POST" })
  .inputValidator((data) => CreateTokenInputSchema.parse(data))
  .handler(async ({ data: { baseUrl, bearerToken, input } }) => {
    return requestJson<{ token: string; tokenInfo: ManagedToken }>(
      { baseUrl, bearerToken },
      "/auth/tokens",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
  });

const UpdateTokenInputSchema = z.object({
  baseUrl: z.string().url(),
  bearerToken: z.string().min(1),
  tokenId: z.string().uuid(),
  input: z.object({
    name: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
    isAdmin: z.boolean().optional(),
    rateLimitPerMinute: z.number().int().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
    expiresAt: z.string().nullable().optional(),
  }),
});

export const updateManagedTokenById = createServerFn({ method: "POST" })
  .inputValidator((data) => UpdateTokenInputSchema.parse(data))
  .handler(async ({ data: { baseUrl, bearerToken, tokenId, input } }) => {
    return requestJson<ManagedToken>({ baseUrl, bearerToken }, `/auth/tokens/${tokenId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  });

const RevokeTokenInputSchema = z.object({
  baseUrl: z.string().url(),
  bearerToken: z.string().min(1),
  tokenId: z.string().uuid(),
});

export const revokeManagedTokenById = createServerFn({ method: "POST" })
  .inputValidator((data) => RevokeTokenInputSchema.parse(data))
  .handler(async ({ data: { baseUrl, bearerToken, tokenId } }) => {
    return requestJson<ManagedToken>({ baseUrl, bearerToken }, `/auth/tokens/${tokenId}`, {
      method: "DELETE",
    });
  });
