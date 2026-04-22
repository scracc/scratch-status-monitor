import { ssmrc } from "@repo/configs";
import { getHistoryService } from "./historyService";
import { createLogger } from "./logger";

const logger = createLogger("CleanupService");

/**
 * v2.0: クリーンアップサービス
 * 古いデータをDBから削除して、ストレージを最適化
 *
 * 注意: Cloudflare WorkersではsetIntervalは使用せず、cronトリガーで定期実行します
 */

let lastCleanupTime: number = 0;

/**
 * クリーンアップを実行
 * cronトリガーまたは必要に応じて手動で呼び出されます
 */
export async function runCleanup(): Promise<void> {
  const now = Date.now();
  const retentionDays = ssmrc.cache.dataRetentionDays;

  logger.info("Starting cleanup", { retentionDays });

  try {
    const historyService = getHistoryService();
    await historyService.cleanup(retentionDays);

    lastCleanupTime = now;
    logger.info("Cleanup completed successfully");
  } catch (err) {
    logger.error("Cleanup failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * クリーンアップの状態を取得
 */
export function getCleanupStatus(): {
  lastCleanupTime: number | null;
  retentionDays: number;
} {
  return {
    lastCleanupTime: lastCleanupTime > 0 ? lastCleanupTime : null,
    retentionDays: ssmrc.cache.dataRetentionDays,
  };
}
