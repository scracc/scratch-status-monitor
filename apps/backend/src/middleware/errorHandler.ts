import { createErrorResponse, ERROR_MESSAGES, type ErrorCode } from "@repo/types";
import type { Context, MiddlewareHandler } from "hono";
import { z } from "zod";
import type { Env } from "../types/env";

/**
 * Zod バリデーションエラーを整形
 */
function formatZodError(error: z.ZodError) {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

  return {
    message: ERROR_MESSAGES.INVALID_INPUT,
    issues,
  };
}

/**
 * グローバルエラーハンドリングミドルウェア
 */
export const errorHandler = (): MiddlewareHandler<{ Bindings: Env }> => {
  return async (c: Context<{ Bindings: Env }>, next) => {
    try {
      await next();
    } catch (error) {
      console.error("Error:", error);

      // Zod バリデーションエラー
      if (error instanceof z.ZodError) {
        return c.json(
          createErrorResponse(
            "VALIDATION_ERROR",
            ERROR_MESSAGES.INVALID_INPUT,
            formatZodError(error)
          ),
          { status: 400 }
        );
      }

      // カスタムエラーレスポンス
      if (error instanceof Error && error.message.startsWith("API_ERROR:")) {
        const [, code, message] = error.message.split(":");
        return c.json(createErrorResponse(code as ErrorCode, message || "Unknown error"), {
          status: 400,
        });
      }

      // タイムアウトエラー
      if (error instanceof Error && error.name === "AbortError") {
        return c.json(createErrorResponse("TIMEOUT", ERROR_MESSAGES.TIMEOUT), { status: 408 });
      }

      // その他のエラー
      return c.json(createErrorResponse("INTERNAL_ERROR", ERROR_MESSAGES.INTERNAL_ERROR), {
        status: 500,
      });
    }
  };
};

/**
 * カスタムAPI エラー作成関数
 */
export class APIError extends Error {
  constructor(
    public code: ErrorCode,
    message: string
  ) {
    super(`API_ERROR:${code}:${message}`);
    this.name = "APIError";
  }
}

/**
 * バリデーションエラーハンドラー
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
}
