import type { StatusResponse as StatusResponseType } from "@repo/types";
import { z } from "zod";
import { APIError } from "../middleware/errorHandler";
import { createLogger } from "../services/logger";
import { checkAllMonitors, getStatus } from "../services/monitorService";
import { UUIDSchema } from "../utils/validators";

const logger = createLogger("StatusHandler");

/**
 * 現在のステータスを取得（キャッシュまたは最新チェック）
 */
export async function getStatusHandler(): Promise<StatusResponseType> {
  try {
    return await getStatus();
  } catch (error) {
    logger.error("Error getting status", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new APIError("INTERNAL_ERROR", "ステータス取得に失敗しました");
  }
}

/**
 * 強制的にステータスをリフレッシュ
 */
export async function refreshStatusHandler(): Promise<StatusResponseType> {
  try {
    return await checkAllMonitors();
  } catch (error) {
    logger.error("Error refreshing status", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new APIError("INTERNAL_ERROR", "ステータス更新に失敗しました");
  }
}

/**
 * 特定のモニターの詳細情報を取得
 */
export async function getMonitorDetailHandler(input: {
  monitorId: string;
}): Promise<StatusResponseType["monitors"][0] | undefined> {
  // 入力バリデーション
  const validated = z
    .object({
      monitorId: UUIDSchema,
    })
    .parse(input);

  try {
    const status = await getStatus();
    const monitor = status.monitors.find((m) => m.id === validated.monitorId);

    if (!monitor) {
      throw new APIError("NOT_FOUND", `モニター ${validated.monitorId} が見つかりません`);
    }

    return monitor;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    logger.error("Error getting monitor detail", {
      monitorId: validated.monitorId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new APIError("INTERNAL_ERROR", "モニター詳細の取得に失敗しました");
  }
}
