import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export function createDatabase(file: string): { client: Database.Database; db: BetterSQLite3Database<typeof schema> } {
  const path = resolve(file);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const client = new Database(path);
  client.pragma("journal_mode = WAL");
  client.pragma("foreign_keys = ON");
  client.pragma("busy_timeout = 5000");
  return { client, db: drizzle(client, { schema }) };
}

export * from "./schema.js";
