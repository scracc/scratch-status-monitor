import { ssmrc } from "@repo/configs";
import {
  HistoryRecord,
  HistoryStats,
  type StatusCheckResult as StatusCheckResultType,
} from "@repo/types";
import { count, desc, eq, lt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { withDb } from "../db/client";
import { historyRecords } from "../db/schema";
import { createLogger } from "./logger";

const logger = createLogger("HistoryService");

/**
 * KV Store に保存する履歴データの構造
 */
interface StoredHistoryData {
  records: Array<{
    id: string;
    monitorId: string;
    status: string;
    statusCode?: number;
    responseTime: number;
    errorMessage?: string;
    recordedAt: string; // ISO 8601形式
    bucketedAt: string; // ISO 8601形式（切り捨て）
  }>;
  lastUpdated: string;
}

/**
 * v2.0: 時刻を指定間隔で切り捨て
 */
function floorToInterval(date: Date, intervalMs: number): Date {
  const time = date.getTime();
  const floored = Math.floor(time / intervalMs) * intervalMs;
  return new Date(floored);
}

/**
 * 履歴サービスのインターフェース
 * v2.0: プロセスストレージ主体、KV はバックアップのみ
 */
export interface HistoryService {
  saveRecord(monitorId: string, result: StatusCheckResultType): Promise<void>;
  getRecords(monitorId: string, limit?: number, offset?: number): Promise<HistoryRecord[]>;
  getTotalCount(monitorId: string): Promise<number>;
  deleteRecords(monitorId: string): Promise<void>;
  cleanup(retentionDays: number): Promise<void>;
  restoreFromBackup(): Promise<void>; // DB 常時利用のため no-op
}

/**
 * メモリベースの履歴サービス（開発用）
 * v2.0: メモリのみで管理、KV バックアップなし
 */
class InMemoryHistoryService implements HistoryService {
  private histories: Map<string, StoredHistoryData> = new Map();

  async saveRecord(monitorId: string, result: StatusCheckResultType): Promise<void> {
    const existing = this.histories.get(monitorId) || {
      records: [],
      lastUpdated: new Date().toISOString(),
    };

    const recordedAt = result.checkedAt;
    const bucketedAt = floorToInterval(recordedAt, ssmrc.cache.bucketIntervalMs);

    existing.records.push({
      id: uuidv4(),
      monitorId,
      status: result.status,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      errorMessage: result.errorMessage,
      recordedAt: recordedAt.toISOString(),
      bucketedAt: bucketedAt.toISOString(),
    });

    existing.lastUpdated = new Date().toISOString();
    this.histories.set(monitorId, existing);
  }

  async getRecords(
    monitorId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<HistoryRecord[]> {
    const data = this.histories.get(monitorId);
    if (!data) return [];

    const total = data.records.length;
    const safeOffset = Math.max(0, offset);
    const end = Math.max(0, total - safeOffset);
    const start = Math.max(0, end - limit);

    return data.records.slice(start, end).map((record) => {
      const recordedAt = new Date(record.recordedAt);
      const bucketedAt = record.bucketedAt
        ? new Date(record.bucketedAt)
        : floorToInterval(recordedAt, ssmrc.cache.bucketIntervalMs);

      return HistoryRecord.parse({
        ...record,
        recordedAt,
        bucketedAt,
      });
    });
  }

  async getTotalCount(monitorId: string): Promise<number> {
    const data = this.histories.get(monitorId);
    return data ? data.records.length : 0;
  }

  async deleteRecords(monitorId: string): Promise<void> {
    this.histories.delete(monitorId);
  }

  async cleanup(retentionDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTime = cutoffDate.getTime();

    for (const [monitorId, data] of this.histories.entries()) {
      data.records = data.records.filter(
        (record) => new Date(record.recordedAt).getTime() > cutoffTime
      );

      if (data.records.length === 0) {
        this.histories.delete(monitorId);
      }
    }
  }

  async restoreFromBackup(): Promise<void> {
    // InMemory版では何もしない
  }
}

/**
 * Drizzle ベースの履歴サービス
 */
class DrizzleHistoryService implements HistoryService {
  async saveRecord(monitorId: string, result: StatusCheckResultType): Promise<void> {
    const recordedAt = result.checkedAt;
    const bucketedAt = floorToInterval(recordedAt, ssmrc.cache.bucketIntervalMs);

    const row = {
      id: uuidv4(),
      monitorId,
      status: result.status,
      statusCode: result.statusCode ?? null,
      responseTime: result.responseTime,
      errorMessage: result.errorMessage ?? null,
      recordedAt,
      bucketedAt,
    };

    await withDb((db) =>
      db
        .insert(historyRecords)
        .values(row)
        .onConflictDoUpdate({
          target: [historyRecords.monitorId, historyRecords.recordedAt],
          set: {
            status: row.status,
            statusCode: row.statusCode,
            responseTime: row.responseTime,
            errorMessage: row.errorMessage,
            bucketedAt: row.bucketedAt,
          },
        })
    );
  }

  async getRecords(
    monitorId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<HistoryRecord[]> {
    const rows = await withDb((db) =>
      db
        .select()
        .from(historyRecords)
        .where(eq(historyRecords.monitorId, monitorId))
        .orderBy(desc(historyRecords.recordedAt))
        .offset(offset)
        .limit(limit)
    );

    const ordered = rows.reverse();
    return ordered.map((record) =>
      HistoryRecord.parse({
        id: record.id,
        monitorId: record.monitorId,
        status: record.status,
        statusCode: record.statusCode ?? undefined,
        responseTime: record.responseTime,
        errorMessage: record.errorMessage ?? undefined,
        recordedAt: record.recordedAt,
        bucketedAt: record.bucketedAt,
      })
    );
  }

  async getTotalCount(monitorId: string): Promise<number> {
    const rows = await withDb((db) =>
      db
        .select({ value: count() })
        .from(historyRecords)
        .where(eq(historyRecords.monitorId, monitorId))
    );

    return Number(rows[0]?.value ?? 0);
  }

  async deleteRecords(monitorId: string): Promise<void> {
    await withDb((db) => db.delete(historyRecords).where(eq(historyRecords.monitorId, monitorId)));
  }

  async cleanup(retentionDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deleted = await withDb((db) =>
      db
        .delete(historyRecords)
        .where(lt(historyRecords.recordedAt, cutoffDate))
        .returning({ id: historyRecords.id })
    );

    logger.info("Cleanup completed", { recordsRemoved: deleted.length });
  }

  async restoreFromBackup(): Promise<void> {
    // DB 常時利用のため復元不要
  }
}

/**
 * 履歴統計を計算
 */
export function calculateHistoryStats(monitorId: string, records: HistoryRecord[]): HistoryStats {
  const upCount = records.filter((r) => r.status === "up").length;
  const degradedCount = records.filter((r) => r.status === "degraded").length;
  const downCount = records.filter((r) => r.status === "down").length;
  const unknownCount = records.filter((r) => r.status === "unknown").length;
  const totalRecords = records.length;

  const uptime = totalRecords > 0 ? (upCount / totalRecords) * 100 : 0;

  const responseTimes = records.map((r) => r.responseTime);
  const avgResponseTime =
    totalRecords > 0
      ? Math.round(responseTimes.reduce((sum, rt) => sum + rt, 0) / totalRecords)
      : 0;
  const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : undefined;
  const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : undefined;

  return HistoryStats.parse({
    monitorId,
    upCount,
    degradedCount,
    downCount,
    unknownCount,
    totalRecords,
    uptime,
    avgResponseTime,
    minResponseTime,
    maxResponseTime,
  });
}

/**
 * 履歴サービスのシングルトンインスタンス
 */
let historyServiceInstance: HistoryService | null = null;

/**
 * 履歴サービスを初期化または取得
 */
export function initializeHistoryService(useDatabase: boolean = false): HistoryService {
  if (historyServiceInstance) {
    return historyServiceInstance;
  }

  if (useDatabase) {
    historyServiceInstance = new DrizzleHistoryService();
  } else {
    historyServiceInstance = new InMemoryHistoryService();
  }

  return historyServiceInstance;
}

/**
 * 履歴サービスインスタンスを取得
 */
export function getHistoryService(): HistoryService {
  if (!historyServiceInstance) {
    historyServiceInstance = new InMemoryHistoryService();
  }
  return historyServiceInstance;
}
