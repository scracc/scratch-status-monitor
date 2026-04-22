import { ssmrc } from "@repo/configs";
import type { StatusResponse as StatusResponseType } from "@repo/types";
import { getCacheService } from "./cacheService";
import { getHistoryService } from "./historyService";
import { checkMultipleMonitors } from "./statusChecker";
import { buildMonitorStatus, buildStatusResponse } from "./statusService";

/**
 * 全てのモニターをチェックして、ステータスを更新
 */
export async function checkAllMonitors(): Promise<StatusResponseType> {
  // 設定からキャッシュ有効期限を取得
  const cacheIntervalMs = ssmrc.cache.statusTtlMs;
  // 設定からチェック対象を構築
  const monitorsToCheck = ssmrc.monitors.map((item) => ({
    id: item.id,
    url: item.url,
    check: item.check,
  }));

  // 並行してチェック実行
  const checkResults = await checkMultipleMonitors(monitorsToCheck, {
    timeout: ssmrc.checks.timeoutMs,
  });

  // チェック結果からモニターステータスを構築
  const monitors = checkResults
    .map((result) => {
      const config = ssmrc.monitors.find((item) => item.id === result.id);
      return config ? buildMonitorStatus(config, result) : null;
    })
    .filter((m) => m !== null);

  // ステータスレスポンスを構築
  const statusResponse = buildStatusResponse(monitors, cacheIntervalMs);

  // キャッシュに保存
  const cacheService = getCacheService();
  await cacheService.set(statusResponse);

  // 履歴に保存
  const historyService = getHistoryService();
  for (const result of checkResults) {
    await historyService.saveRecord(result.id, result);
  }

  return statusResponse;
}

/**
 * キャッシュされたステータスを取得、なければ新規チェック実行
 */
export async function getStatus(): Promise<StatusResponseType> {
  const cacheService = getCacheService();
  const cached = await cacheService.get();

  if (cached) {
    return cached;
  }

  return checkAllMonitors();
}

/**
 * キャッシュをクリア
 */
export async function clearCache(): Promise<void> {
  const cacheService = getCacheService();
  await cacheService.delete();
}
