import type { ssmrcType } from "@repo/types";

export const cache: ssmrcType.e.cache = {
  // キャッシュの有効期限（ミリ秒）
  statusTtlMs: 5 * 60 * 1000, // 5分
  // 履歴データのバケット間隔（ミリ秒）- v2.0: 時刻の切り捨てに使用
  bucketIntervalMs: 5 * 60 * 1000, // 5分
  // データ保持期間（日数）- v2.0: メモリ管理用
  dataRetentionDays: 7, // 7日間
};
