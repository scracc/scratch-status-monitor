import type { HistoryResponse as HistoryResponseSchema, SerializedInfer } from "@repo/types";

// シリアライズされた型（Date -> string）
export type HistoryResponse = SerializedInfer<typeof HistoryResponseSchema>;

export type HistoryApiEnvelope = {
  success: boolean;
  data: HistoryResponse[];
  message?: string;
};

export type StatusPageLoaderData = {
  histories: HistoryResponse[];
  nextRefreshAt: number;
  refreshIntervalMs: number;
};
