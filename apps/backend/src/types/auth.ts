export interface AuthTokenPrincipal {
  source: "legacy" | "managed";
  tokenId: string | null;
  name: string;
  isAdmin: boolean;
  rateLimitPerMinute: number;
  settings: Record<string, unknown>;
}

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

export interface CreateManagedTokenInput {
  name: string;
  isAdmin?: boolean;
  rateLimitPerMinute?: number;
  settings?: Record<string, unknown>;
  expiresAt?: string | null;
}

export interface UpdateManagedTokenInput {
  name?: string;
  isActive?: boolean;
  isAdmin?: boolean;
  rateLimitPerMinute?: number;
  settings?: Record<string, unknown>;
  expiresAt?: string | null;
}
