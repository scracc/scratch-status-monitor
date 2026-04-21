/**
 * Cloudflare Workers 環境変数の型定義
 */
export interface Env {
  /**
   * API Bearer 認証トークン（後方互換/ブートストラップ用）
   * 環境変数: API_TOKEN
   */
  API_TOKEN?: string;

  /**
   * Drizzle 用 Postgres 接続文字列
   * 環境変数: DATABASE_URL
   */
  DATABASE_URL?: string;

  /**
   * 環境モード
   * development: 開発環境（テストルート有効）
   * production: 本番環境（テストルート無効）
   */
  ENVIRONMENT?: "development" | "production";

  /**
   * API のベース URL（cron のキャッシュウォーム用）
   * 環境変数: API_BASE_URL
   * 例: https://api.ssm.scra.cc
   */
  API_BASE_URL?: string;
}
