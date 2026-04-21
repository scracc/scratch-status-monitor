import { createRoute, z } from "@hono/zod-openapi";
import {
  createManagedToken,
  listManagedTokens,
  revokeManagedTokenById,
  updateManagedTokenById,
} from "../services/tokenService";
import { UUIDSchema } from "../utils/validators";
import { type AppRouter, requireAdmin, successSchema } from "./core";

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

const forbiddenResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
});

export const registerTokenRoutes = (router: AppRouter) => {
  const listTokensRoute = createRoute({
    method: "get",
    path: "/auth/tokens",
    tags: ["Tokens"],
    summary: "管理トークンの一覧を取得",
    description: "管理対象 API トークンのメタデータを返します（生トークンは返しません）",
    responses: {
      403: {
        description: "管理権限がありません",
        content: {
          "application/json": {
            schema: forbiddenResponseSchema,
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
    tags: ["Tokens"],
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
            schema: forbiddenResponseSchema,
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
    tags: ["Tokens"],
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
            schema: forbiddenResponseSchema,
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
    tags: ["Tokens"],
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
            schema: forbiddenResponseSchema,
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
};
