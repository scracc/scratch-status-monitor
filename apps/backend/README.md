# Scratch Status Monitor - Backend

Cloudflare Workers + Hono によるステータス監視 API

## セットアップ

### 依存関係のインストール

```bash
npm install
```

### 環境変数の設定

`.dev.vars.example` を `.dev.vars` にコピーして、環境変数を設定してください：

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` の設定例：

```bash
# API Bearer 認証トークン（ブートストラップ用 / 任意）
API_TOKEN=your-secret-token-here

# 環境モード
ENVIRONMENT=development
```

Drizzle を使う場合は `.env.example` を `.env` にコピーし、`DATABASE_URL` を設定してください。

```bash
cp .env.example .env
```

## 開発

### ローカル開発サーバーの起動

```bash
npm run dev
```

### 型定義の生成

[Worker 設定に基づいて型を生成/同期](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```bash
npm run cf-typegen
```

## Drizzle

Supabase(Postgres) に対して Drizzle でスキーマ管理・SQL 実行ができます。

### 必要な環境変数

- `DATABASE_URL` (Supabase の Postgres 接続文字列)

### スキーマ定義

- `src/db/schema.ts`

### コマンド

```bash
npm run db:drizzle:generate
npm run db:drizzle:migrate
npm run db:drizzle:push
npm run db:drizzle:studio
```

## 認証

Bearer 認証で保護されています。環境に応じて適用範囲が変わります。

### 認証方式

- `API_TOKEN`（環境変数）
  - 後方互換と初期管理者トークンとして利用できます
- 管理トークン（Postgres `api_tokens` テーブル）
  - API から発行・更新・失効できます
  - トークンごとに `rate_limit_per_minute` と `settings` を持てます

### 本番環境 (ENVIRONMENT=production)

- **全てのルート**に認証が必要

```bash
curl -H "Authorization: Bearer your-secret-token-here" \
  https://api.ssm.scratchcore.org/api/status
```

### 開発環境 (ENVIRONMENT=development)

以下のルートは認証**不要**:

- `/` - ルートエンドポイント
- `/test/*` - テストエンドポイント
- `/docs` - API ドキュメント (Scalar UI)
- `/openapi.json` - OpenAPI 仕様

上記以外のルートは認証が必要:

```bash
curl -H "Authorization: Bearer your-token" \
  http://localhost:8787/status
```

### 認証の無効化

開発環境で `/test/*`, `/debug/*`, `/docs`, `/openapi.json`, `/` は認証不要です。
それ以外はトークン認証が必要です。

## トークン管理 API

以下の管理 API は `admin` 権限トークンで利用できます。

- `GET /auth/tokens` - トークン一覧（生トークンは返さない）
- `POST /auth/tokens` - トークン発行（生トークンはこのレスポンスでのみ返却）
- `PATCH /auth/tokens/:tokenId` - トークン設定更新
- `DELETE /auth/tokens/:tokenId` - トークン失効

### 例: トークンを発行

```bash
curl -X POST http://localhost:8787/auth/tokens \
  -H "Authorization: Bearer your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "monitoring-client",
    "rateLimitPerMinute": 120,
    "isAdmin": false,
    "settings": {"project": "frontend"}
  }'
```

## テストエンドポイント

開発環境 (`ENVIRONMENT=development`) のみ、以下のテストエンドポイントが有効です（認証不要）：

- `POST /test/trigger-monitor-check` - 手動でモニターチェックをトリガー

本番環境では 404 を返します。

## デプロイ

```bash
npm run deploy
```

デプロイ時には Cloudflare Dashboard で以下の環境変数を設定してください：

- `API_TOKEN` - 初期管理者トークン（推奨）
- `ENVIRONMENT` - `production` に設定
- `DATABASE_URL`
## API ドキュメント

- OpenAPI 仕様: `/openapi.json`
- Scalar UI: `/docs`

