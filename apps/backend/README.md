# Scratch Status Monitor Backend

Cloudflare Workers + Hono + Drizzle で構成されたステータス監視 API です。

## クイックスタート

### 1. 依存関係をインストール

```bash
npm install
```

### 2. 環境変数ファイルを作成

```bash
cp .dev.vars.example .dev.vars
cp .env.example .env
```

最低限、次を設定してください。

- `.dev.vars`
  - `ENVIRONMENT=development`
  - `API_TOKEN=your-secret-token-here`（任意だが推奨）
- `.env`
  - `DATABASE_URL=...`（Supabase Postgres 接続文字列）

### 3. 開発サーバー起動

```bash
npm run dev
```

### 4. 型定義を更新（設定を変えたとき）

```bash
npm run cf-typegen
```

## Drizzle 運用

スキーマ定義:

- `src/db/schema.ts`

主なコマンド:

```bash
npm run db:drizzle:generate
npm run db:drizzle:migrate
npm run db:drizzle:push
npm run db:drizzle:studio
```

## 認証

Bearer 認証です。環境によって適用範囲が異なります。

### 認証方式

1. `API_TOKEN`（環境変数）
- 後方互換と初期管理者トークン用途

2. 管理トークン（Postgres `api_tokens` テーブル）
- API から発行・更新・失効
- トークンごとに `rate_limit_per_minute` と `settings` を設定可能

### 本番環境

- `ENVIRONMENT=production` のとき、全ルートで認証が必要

```bash
curl -H "Authorization: Bearer your-secret-token-here" \
  https://api.ssm.scratchcore.org/api/status
```

### 開発環境

- `ENVIRONMENT=development` のとき、次は認証不要
  - `/`
  - `/test/*`
  - `/docs`
  - `/openapi.json`
- それ以外は認証が必要

```bash
curl -H "Authorization: Bearer your-token" \
  http://localhost:8787/status
```

## トークン管理 API

以下は admin 権限トークンが必要です。

- `GET /auth/tokens` トークン一覧（生トークンは返さない）
- `POST /auth/tokens` トークン発行（生トークンはこのレスポンスのみ）
- `PATCH /auth/tokens/:tokenId` トークン設定更新
- `DELETE /auth/tokens/:tokenId` トークン失効

発行例:

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

## テスト用エンドポイント

開発環境のみ有効:

- `POST /test/trigger-monitor-check` 手動モニターチェック

本番環境では 404 を返します。

## デプロイ

```bash
npm run deploy
```

Cloudflare Dashboard の必須環境変数:

- `API_TOKEN`（初期管理者トークン、推奨）
- `ENVIRONMENT=production`
- `DATABASE_URL`

## API ドキュメント

- OpenAPI: `/openapi.json`
- Scalar UI: `/docs`

