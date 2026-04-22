import type {
  HistoryRecord as HistoryRecordSchema,
  HistoryResponse as HistoryResponseSchema,
  MonitorStatus as MonitorStatusSchema,
  SerializedInfer,
  StatusLevelType,
  StatusResponse as StatusResponseSchema,
} from "@repo/types";

// シリアライズされた型（Date -> string）
export type StatusLevel = StatusLevelType;
export type MonitorStatus = SerializedInfer<typeof MonitorStatusSchema>;
export type StatusResponse = SerializedInfer<typeof StatusResponseSchema>;
export type HistoryRecord = SerializedInfer<typeof HistoryRecordSchema>;
export type HistoryResponse = SerializedInfer<typeof HistoryResponseSchema>;

export const colorSlugMapping: Record<keyof typeof colorMapping, string> = {
  Operational: "emerald",
  Maintenance: "amber",
  Downtime: "red",
  "Not measured": "gray",
};

export const colorMapping = {
  Operational: "bg-emerald-500",
  Downtime: "bg-red-500",
  Maintenance: "bg-amber-500",
  "Not measured": "bg-gray-400",
};

export const statusLabel: Record<StatusLevel, string> = {
  up: "稼働中",
  degraded: "一部障害",
  down: "停止",
  unknown: "未計測",
};

export const statusToTooltip: Record<StatusLevel, keyof typeof colorMapping> = {
  up: "Operational",
  degraded: "Maintenance",
  down: "Downtime",
  unknown: "Not measured",
};

export const iconClassByTooltip: Record<keyof typeof colorMapping, string> = {
  Operational: "text-emerald-500",
  Maintenance: "text-amber-500",
  Downtime: "text-red-500",
  "Not measured": "text-gray-400",
};
