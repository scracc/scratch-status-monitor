import type {
  HistoryResponse as HistoryResponseType,
  HistoryStats as HistoryStatsType,
} from "@repo/types";
import { z } from "zod";
import { BACKEND_DEFAULTS } from "../config/defaults";
import { APIError } from "../middleware/errorHandler";
import { calculateHistoryStats, getHistoryService } from "../services/historyService";
import { createLogger } from "../services/logger";
import { getStatus } from "../services/monitorService";
import { UUIDSchema } from "../utils/validators";

const logger = createLogger("HistoryHandler");

/**
 * 特定のモニターの履歴を取得
 */
export async function getMonitorHistoryHandler(input: {
  monitorId: string;
  limit?: number;
  offset?: number;
}): Promise<HistoryResponseType> {
  // 入力バリデーション
  const validated = z
    .object({
      monitorId: UUIDSchema,
      limit: z.number().int().min(1).max(1000).default(100).optional(),
      offset: z.number().int().min(0).default(0).optional(),
    })
    .parse(input);

  try {
    const { monitorId, limit = 100, offset = 0 } = validated;

    const historyService = getHistoryService();
    // 総レコード数を取得してhasMoreを正確に判定
    const [records, totalCount] = await Promise.all([
      historyService.getRecords(monitorId, limit, offset),
      historyService.getTotalCount(monitorId),
    ]);
    const hasMore = offset + limit < totalCount;

    // モニター情報を取得
    const status = await getStatus();
    const monitor = status.monitors.find((m) => m.id === monitorId);

    if (!monitor) {
      throw new APIError("NOT_FOUND", `モニター ${monitorId} が見つかりません`);
    }

    // 統計情報を計算（全レコードを使用して正確な統計を算出）
    const allRecordsForStats = await historyService.getRecords(
      monitorId,
      BACKEND_DEFAULTS.HISTORY_RECORDS_LIMIT
    );
    const stats = calculateHistoryStats(monitorId, allRecordsForStats);

    const response: HistoryResponseType = {
      monitorId,
      label: monitor.label,
      records,
      totalRecords: records.length,
      oldestRecord: records.length > 0 ? records[0].recordedAt : undefined,
      newestRecord: records.length > 0 ? records[records.length - 1].recordedAt : undefined,
      hasMore,
      stats: {
        upCount: stats.upCount,
        degradedCount: stats.degradedCount,
        downCount: stats.downCount,
        unknownCount: stats.unknownCount,
        uptime: stats.uptime,
        avgResponseTime: stats.avgResponseTime,
        minResponseTime: stats.minResponseTime,
        maxResponseTime: stats.maxResponseTime,
      },
    };

    return response;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    logger.error("Error getting monitor history", {
      monitorId: validated.monitorId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new APIError("INTERNAL_ERROR", "履歴取得に失敗しました");
  }
}

/**
 * 複数のモニターの履歴を一括取得
 */
export async function getAllMonitorsHistoryHandler(input: {
  limit?: number;
  offset?: number;
}): Promise<HistoryResponseType[]> {
  // 入力バリデーション
  const validated = z
    .object({
      limit: z.number().int().min(1).max(1000).default(100).optional(),
      offset: z.number().int().min(0).default(0).optional(),
    })
    .parse(input);

  try {
    const { limit = 100, offset = 0 } = validated;
    const status = await getStatus();

    const historyService = getHistoryService();
    const results = await Promise.all(
      status.monitors.map(async (monitor) => {
        // 総レコード数を取得してhasMoreを正確に判定
        const [records, totalCount] = await Promise.all([
          historyService.getRecords(monitor.id, limit, offset),
          historyService.getTotalCount(monitor.id),
        ]);
        const hasMore = offset + limit < totalCount;

        // 統計情報を計算（全レコードを使用して正確な統計を算出）
        const allRecordsForStats = await historyService.getRecords(
          monitor.id,
          BACKEND_DEFAULTS.HISTORY_RECORDS_LIMIT
        );
        const stats = calculateHistoryStats(monitor.id, allRecordsForStats);

        const response: HistoryResponseType = {
          monitorId: monitor.id,
          label: monitor.label,
          records,
          totalRecords: records.length,
          oldestRecord: records.length > 0 ? records[0].recordedAt : undefined,
          newestRecord: records.length > 0 ? records[records.length - 1].recordedAt : undefined,
          hasMore,
          stats: {
            upCount: stats.upCount,
            degradedCount: stats.degradedCount,
            downCount: stats.downCount,
            unknownCount: stats.unknownCount,
            uptime: stats.uptime,
            avgResponseTime: stats.avgResponseTime,
            minResponseTime: stats.minResponseTime,
            maxResponseTime: stats.maxResponseTime,
          },
        };
        return response;
      })
    );

    return results;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    logger.error("Error getting all histories", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new APIError("INTERNAL_ERROR", "複数履歴取得に失敗しました");
  }
}

/**
 * 特定のモニターの統計情報を取得
 */
export async function getMonitorStatsHandler(input: {
  monitorId: string;
  limit?: number;
}): Promise<HistoryStatsType> {
  // 入力バリデーション
  const validated = z
    .object({
      monitorId: UUIDSchema,
      limit: z.number().int().min(1).max(1000).default(100).optional(),
    })
    .parse(input);

  try {
    const { monitorId, limit = 100 } = validated;

    const historyService = getHistoryService();
    const records = await historyService.getRecords(monitorId, limit);

    return calculateHistoryStats(monitorId, records);
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    logger.error("Error getting monitor stats", {
      monitorId: validated.monitorId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new APIError("INTERNAL_ERROR", "統計情報取得に失敗しました");
  }
}

/**
 * 履歴をクリア（管理者用）
 */
export async function clearMonitorHistoryHandler(input: {
  monitorId: string;
}): Promise<{ success: boolean; message: string }> {
  const { monitorId } = input;

  const historyService = getHistoryService();
  await historyService.deleteRecords(monitorId);

  return {
    success: true,
    message: `History for monitor ${monitorId} has been cleared`,
  };
}
