import { logger } from "@scracc/tanstack-plugin-logger";
import { defineEventHandler, readBody } from "h3";
import { getEnv } from "@/plugins/envrc";

export default defineEventHandler(async (event) => {
  try {
    const env = getEnv();

    // Sentry の Envelope は JSON ではないため、文字列として取得します
    const body = await readBody<string>(event);

    if (!body) {
      // 標準の Response オブジェクトを返せば、h3 が適切に処理します
      return new Response("Payload is empty", { status: 400 });
    }

    // Envelope の解析（1行目がヘッダー JSON）
    const envelope = body;
    const headerLine = envelope.split("\n")[0];
    const header = JSON.parse(headerLine);

    if (!header.dsn) {
      return new Response("DSN missing", { status: 400 });
    }

    // --- セキュリティチェック ---
    // DSN が自分のプロジェクトのものか検証（環境変数と比較するのがベスト）
    const dsn = new URL(header.dsn);
    const projectId = dsn.pathname.replace("/", "");

    // 許可する Sentry ホストやプロジェクトIDをチェック
    if (String(dsn) !== env.VITE_SENTRY_DSN) {
      return new Response("Unauthorized", { status: 403 });
    }

    // 3. 転送先 URL の構築
    const sentryUrl = `https://${dsn.host}/api/${projectId}/envelope/`;

    // 4. Sentry サーバーへ転送
    const response = await fetch(sentryUrl, {
      method: "POST",
      body: body,
      headers: {
        "Content-Type": "application/x-sentry-envelope",
      },
    });

    return response.status;
  } catch (error) {
    // 予期せぬエラーの場合
    logger({ level: "error", name: "Sentry" }, "Sentry Tunnel Error", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});
