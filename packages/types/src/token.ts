/**
 * トークン管理 API の型定義
 */

/**
 * 認証トークン プリンシパル
 * トークン認証後にコンテキストに入る情報
 */
export interface AuthTokenPrincipal {
  source: "legacy" | "managed";
  tokenId: string | null;
  name: string;
  isAdmin: boolean;
  rateLimitPerMinute: number;
  settings: Record<string, unknown>;
}

/**
 * 管理トークン レコード
 * データベースに保存されるトークンのメタデータ
 */
export interface ManagedTokenRecord {
  id: string;
  name: string;
  tokenPrefix: string;
  isActive: boolean;
  isAdmin: boolean;
  rateLimitPerMinute: number;
  settings: Record<string, unknown>;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 管理トークン作成リクエスト
 */
export interface CreateManagedTokenInput {
  name: string;
  isAdmin?: boolean;
  rateLimitPerMinute?: number;
  settings?: Record<string, unknown>;
  expiresAt?: string | null;
}

/**
 * 管理トークン更新リクエスト
 */
export interface UpdateManagedTokenInput {
  name?: string;
  isActive?: boolean;
  isAdmin?: boolean;
  rateLimitPerMinute?: number;
  settings?: Record<string, unknown>;
  expiresAt?: string | null;
}
