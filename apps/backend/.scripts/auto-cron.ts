/**
 * ローカル開発用: 設定間隔でモニターチェックを定期実行
 *
 * 使用方法:
 *   tsx .scripts/auto-cron.ts
 */

import { ssmrc } from "@repo/configs";

/**
 * ログ出力（タイムスタンプ付き）
 */
function log(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}]`;
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

/**
 * 定期実行開始
 */
async function startAutoCron(): Promise<void> {
  const intervalMs = ssmrc.cache.statusTtlMs;
  const intervalSec = Math.round(intervalMs / 1000);

  log("🚀 Auto Cron 起動", {
    interval: `${intervalSec}秒 (${intervalMs}ms)`,
  });

  const onRun = async () => {
    const now = new Date();
    const result = await fetch("http://localhost:8787/cdn-cgi/handler/scheduled");
    if (!result.ok) {
      throw new Error(`HTTP error! status: ${result.status}`);
    }
    const res_time = Date.now() - now.getTime();
    log(`✅ モニターチェック実行完了`, `応答時間: ${res_time}ms`);
  };

  // 初回は即座に実行
  await onRun();

  // 以降は定期実行
  setInterval(async () => {
    await onRun();
  }, intervalMs);

  log("📍 定期実行を開始しました。終了するには Ctrl+C を押してください。");
}

// エラーハンドリング
process.on("unhandledRejection", (reason) => {
  log("❌ エラー", reason);
});

process.on("SIGINT", () => {
  log("🛑 Auto Cron 停止");
  process.exit(0);
});

// 実行開始
startAutoCron().catch((error) => {
  log("❌ 起動失敗", error);
  process.exit(1);
});
