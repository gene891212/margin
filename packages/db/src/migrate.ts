import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createDatabase } from "./index.js";

export function migrateDatabase(databaseFile: string): ReturnType<typeof createDatabase> {
  const { client, db } = createDatabase(databaseFile);
  const currentVersion = client.pragma("user_version", { simple: true }) as number;
  if (currentVersion < 1) {
    const migrationPath = fileURLToPath(new URL("../migrations/0001_initial.sql", import.meta.url));
    const migrationSql = readFileSync(migrationPath, "utf8");
    client.transaction(() => {
      client.exec(migrationSql);
      client.pragma("user_version = 1");
    })();
  }
  if (currentVersion < 2) {
    const migrationPath = fileURLToPath(new URL("../migrations/0002_universal_profile.sql", import.meta.url));
    const migrationSql = readFileSync(migrationPath, "utf8");
    client.transaction(() => {
      client.exec(migrationSql);
      client.pragma("user_version = 2");
    })();
  }
  return { client, db };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const file = resolve(projectRoot, process.env.DATABASE_FILE ?? "./data/app.sqlite");
  const { client } = migrateDatabase(file);
  client.close();
  console.log(`SQLite migration complete: ${file}`);
}
