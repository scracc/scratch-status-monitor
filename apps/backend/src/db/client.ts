import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Env } from "../types/env";
import * as schema from "./schema";

let databaseUrl: string | null = null;

export type AppDb = PostgresJsDatabase<typeof schema>;

export function initializeDb(env: Env): void {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  databaseUrl = env.DATABASE_URL;
}

export function getDb(): AppDb {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not initialized");
  }

  const client = postgres(databaseUrl, {
    prepare: false,
    max: 1,
  });

  return drizzle(client, { schema });
}

export async function withDb<T>(action: (db: AppDb) => Promise<T>): Promise<T> {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not initialized");
  }

  const client = postgres(databaseUrl, {
    prepare: false,
    max: 1,
  });

  try {
    const db = drizzle(client, { schema });
    return await action(db);
  } finally {
    await client.end();
  }
}
