import { z } from "zod";

/**
 * UUIDバリデーション
 */
export const UUIDSchema = z.uuid("有効なUUIDである必要があります");

/**
 * URLバリデーション
 */
export const URLSchema = z
  .url("有効なURLである必要があります")
  .refine(
    (url) => url.startsWith("http://") || url.startsWith("https://"),
    "HTTPまたはHTTPSのURLである必要があります"
  );

/**
 * 日付バリデーション
 */
export const DateSchema = z.date().refine((date) => date <= new Date(), {
  message: "未来の日付は指定できません",
});

/**
 * ページネーションパラメーター
 */
export const PaginationSchema = z.object({
  limit: z
    .number()
    .int("整数である必要があります")
    .min(1, "1以上である必要があります")
    .max(1000, "1000以下である必要があります")
    .default(100),
  offset: z.number().int("整数である必要があります").min(0, "0以上である必要があります").default(0),
});

export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * 日付範囲フィルター
 */
export const DateRangeSchema = z.object({
  startDate: DateSchema.optional(),
  endDate: DateSchema.optional(),
});

export type DateRange = z.infer<typeof DateRangeSchema>;

/**
 * ソートパラメーター
 */
export const SortSchema = z.object({
  field: z.string(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type Sort = z.infer<typeof SortSchema>;

/**
 * クエリフィルター基底
 */
export const QueryFilterSchema = z.object({
  pagination: PaginationSchema.optional(),
  dateRange: DateRangeSchema.optional(),
  sort: SortSchema.optional(),
});

export type QueryFilter = z.infer<typeof QueryFilterSchema>;
