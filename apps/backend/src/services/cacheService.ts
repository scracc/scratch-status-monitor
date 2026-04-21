import { ssmrc } from "@scracc/ssm-configs";
import { StatusResponse, type StatusResponse as StatusResponseType } from "@scracc/ssm-types";
import { eq } from "drizzle-orm";
import { withDb } from "../db/client";
import { statusCache } from "../db/schema";

const CACHE_KEY = "monitor:status:latest";
function serializeStatusResponse(data: StatusResponseType): Record<string, unknown> {
  return {
    ...data,
    timestamp: data.timestamp.toISOString(),
    expiresAt: data.expiresAt.toISOString(),
    monitors: data.monitors.map((monitor) => ({
      ...monitor,
      lastCheckedAt: monitor.lastCheckedAt.toISOString(),
    })),
  };
}

function deserializeStatusResponse(data: unknown): StatusResponseType {
  const record = data as Record<string, unknown>;
  const monitors = Array.isArray(record.monitors) ? record.monitors : [];

  return StatusResponse.parse({
    ...record,
    timestamp: new Date(String(record.timestamp)),
    expiresAt: new Date(String(record.expiresAt)),
    monitors: monitors.map((monitor) => {
      const monitorRecord = monitor as Record<string, unknown>;
      return {
        ...monitorRecord,
        lastCheckedAt: new Date(String(monitorRecord.lastCheckedAt)),
      };
    }),
  });
}

export interface CacheService {
  get(): Promise<StatusResponseType | null>;
  set(data: StatusResponseType): Promise<void>;
  delete(): Promise<void>;
  restoreFromBackup(): Promise<void>; // DB 常時利用のため no-op
}

/**
 * メモリキャッシュベースのCacheService（開発用）
 * v2.0: メモリ上でのみキャッシュを管理、KV バックアップなし
 */
class InMemoryCacheService implements CacheService {
  private cache: Map<string, { data: StatusResponseType; expiresAt: number }> = new Map();

  async get(): Promise<StatusResponseType | null> {
    const entry = this.cache.get(CACHE_KEY);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(CACHE_KEY);
      return null;
    }

    return entry.data;
  }

  async set(data: StatusResponseType): Promise<void> {
    const expiresAt = Date.now() + ssmrc.cache.statusTtlMs;
    this.cache.set(CACHE_KEY, { data, expiresAt });
  }

  async delete(): Promise<void> {
    this.cache.delete(CACHE_KEY);
  }

  async restoreFromBackup(): Promise<void> {
    // InMemory版では何もしない
  }
}

/**
 * Drizzle 対応の CacheService
 * - メモリに保持しつつ Postgres に永続化
 */
class DrizzleCacheService implements CacheService {
  private memoryCache: Map<string, { data: StatusResponseType; expiresAt: number }> = new Map();

  async get(): Promise<StatusResponseType | null> {
    const memEntry = this.memoryCache.get(CACHE_KEY);
    if (memEntry && Date.now() <= memEntry.expiresAt) {
      return memEntry.data;
    }

    if (memEntry) {
      this.memoryCache.delete(CACHE_KEY);
    }

    const row = await withDb((db) =>
      db.query.statusCache.findFirst({
        where: eq(statusCache.key, CACHE_KEY),
        columns: {
          data: true,
          expiresAt: true,
        },
      })
    );

    if (!row) {
      return null;
    }

    const expiresAt = row.expiresAt.getTime();
    if (Date.now() > expiresAt) {
      await this.delete();
      return null;
    }

    const revived = deserializeStatusResponse(row.data);
    this.memoryCache.set(CACHE_KEY, { data: revived, expiresAt });
    return revived;
  }

  async set(data: StatusResponseType): Promise<void> {
    const expiresAt = Date.now() + ssmrc.cache.statusTtlMs;
    this.memoryCache.set(CACHE_KEY, { data, expiresAt });

    const payload = {
      key: CACHE_KEY,
      data: serializeStatusResponse(data),
      expiresAt: new Date(expiresAt),
      updatedAt: new Date(),
    };

    await withDb((db) =>
      db
        .insert(statusCache)
        .values(payload)
        .onConflictDoUpdate({
          target: statusCache.key,
          set: {
            data: payload.data,
            expiresAt: payload.expiresAt,
            updatedAt: payload.updatedAt,
          },
        })
    );
  }

  async delete(): Promise<void> {
    this.memoryCache.delete(CACHE_KEY);
    await withDb((db) => db.delete(statusCache).where(eq(statusCache.key, CACHE_KEY)));
  }

  async restoreFromBackup(): Promise<void> {
    // DB 常時利用のため復元不要
  }
}

/**
 * Cacheサービスのシングルトンインスタンス
 */
let cacheServiceInstance: CacheService | null = null;

/**
 * CacheServiceを初期化または取得
 * @param kv Cloudflare Workers KVオブジェクト（オプション）
 */
export function initializeCacheService(useDatabase: boolean = false): CacheService {
  if (cacheServiceInstance) {
    return cacheServiceInstance;
  }

  if (useDatabase) {
    cacheServiceInstance = new DrizzleCacheService();
  } else {
    // 開発環境ではメモリキャッシュを使用
    cacheServiceInstance = new InMemoryCacheService();
  }

  return cacheServiceInstance;
}

/**
 * CacheServiceインスタンスを取得
 */
export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new InMemoryCacheService();
  }
  return cacheServiceInstance;
}
