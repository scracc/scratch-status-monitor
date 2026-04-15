/**
 * @scratchcore/ssm-types
 * バックエンド・フロントエンド間で共有する型定義
 */

// API Metadata関連
export type { ApiMetadata } from "./api-metadata.js";
// Error関連
export {
  APIResponse,
  type APIResponse as APIResponseType,
  createErrorResponse,
  createSuccessResponse,
  ERROR_MESSAGES,
  type ErrorCode,
  ErrorCodeEnum,
  ErrorResponse,
  type ErrorResponse as ErrorResponseType,
  SuccessResponse,
  type SuccessResponse as SuccessResponseType,
} from "./error.js";
// History関連
export {
  HistoryRecord,
  type HistoryRecord as HistoryRecordType,
  HistoryResponse,
  type HistoryResponse as HistoryResponseType,
  HistoryStats,
  type HistoryStats as HistoryStatsType,
  MonitorHistory,
  type MonitorHistory as MonitorHistoryType,
} from "./history.js";
// Monitor関連
export type { Monitor, MonitorConfig } from "./monitor.js";
// Serialization helpers
export type { Serialized, SerializedInfer } from "./serialized.js";
// Config関連
export { _ssmrcSchema as ssmrcSchema, type _ssmrcType as ssmrcType } from "./ssmrc/index.js";
// Status関連
export {
  CategoryStatus,
  type CategoryStatus as CategoryStatusType,
  MonitorStatus,
  type MonitorStatus as MonitorStatusType,
  StatusCheckResult,
  type StatusCheckResult as StatusCheckResultType,
  StatusLevel,
  type StatusLevel as StatusLevelType,
  StatusResponse,
  type StatusResponse as StatusResponseType,
} from "./status.js";
// Token関連
export type {
  AuthTokenPrincipal,
  CreateManagedTokenInput,
  ManagedTokenRecord,
  UpdateManagedTokenInput,
} from "./token.js";
