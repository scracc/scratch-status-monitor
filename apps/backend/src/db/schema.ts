import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm/sql";

export const statusCache = pgTable(
  "status_cache",
  {
    key: text("key").primaryKey(),
    data: jsonb("data").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_status_cache_expires").on(table.expiresAt)]
);

export const historyRecords = pgTable(
  "history_records",
  {
    id: uuid("id").primaryKey(),
    monitorId: uuid("monitor_id").notNull(),
    status: text("status").notNull().$type<"up" | "degraded" | "down" | "unknown">(),
    statusCode: integer("status_code"),
    responseTime: integer("response_time").notNull(),
    errorMessage: text("error_message"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    bucketedAt: timestamp("bucketed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_history_monitor_recorded").on(table.monitorId, table.recordedAt),
    index("idx_history_bucketed").on(table.bucketedAt),
    index("idx_history_recorded").on(table.recordedAt),
    uniqueIndex("idx_history_unique_monitor_recorded").on(table.monitorId, table.recordedAt),
    check(
      "history_records_status_check",
      sql`${table.status} in ('up', 'degraded', 'down', 'unknown')`
    ),
  ]
);

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPrefix: text("token_prefix").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isAdmin: boolean("is_admin").notNull().default(false),
    rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(60),
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_api_tokens_active_expires").on(table.isActive, table.expiresAt),
    index("idx_api_tokens_last_used").on(table.lastUsedAt),
    check("api_tokens_rate_limit_per_minute_check", sql`${table.rateLimitPerMinute} > 0`),
  ]
);

export type StatusCache = typeof statusCache.$inferSelect;
export type NewStatusCache = typeof statusCache.$inferInsert;

export type HistoryRecord = typeof historyRecords.$inferSelect;
export type NewHistoryRecord = typeof historyRecords.$inferInsert;

export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
