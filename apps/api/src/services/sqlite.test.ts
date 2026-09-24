import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase, translationJobs } from "@wct/db";
import { migrateDatabase } from "@wct/db/migrate";

let tempDirectory: string | undefined;
afterEach(() => {
  if (tempDirectory) rmSync(tempDirectory, { recursive: true, force: true });
  tempDirectory = undefined;
});

describe("SQLite migration", () => {
  it("creates tables and preserves jobs across reopen", () => {
    tempDirectory = mkdtempSync(join(tmpdir(), "margin-db-test-"));
    const file = join(tempDirectory, "app.sqlite");
    const first = migrateDatabase(file);
    first.db.insert(translationJobs).values({
      id: "job-1", sourceUrl: "https://example.com/article", targetLanguage: "zh-TW"
    }).run();
    expect(first.client.pragma("journal_mode", { simple: true })).toBe("wal");
    first.client.close();

    const second = migrateDatabase(file);
    expect(second.db.select().from(translationJobs).all()).toHaveLength(1);
    expect(second.client.pragma("user_version", { simple: true })).toBe(2);
    second.client.close();
  });

  it("upgrades a v1 profile without losing its jobs", () => {
    tempDirectory = mkdtempSync(join(tmpdir(), "margin-db-test-"));
    const initialSql = readFileSync(fileURLToPath(new URL("../../../../packages/db/migrations/0001_initial.sql", import.meta.url)), "utf8");
    const file = join(tempDirectory, "legacy.sqlite");
    const { client: legacy } = createDatabase(file);
    legacy.exec(initialSql);
    legacy.prepare("INSERT INTO browser_profiles (id, name, status) VALUES (?, ?, ?)").run("profile-1", "Old", "ready");
    legacy.prepare("INSERT INTO browser_profile_hosts (profile_id, hostname) VALUES (?, ?)").run("profile-1", "example.com");
    legacy.prepare("INSERT INTO translation_jobs (id, source_url, target_language, browser_profile_id) VALUES (?, ?, ?, ?)")
      .run("job-1", "https://example.com/article", "zh-TW", "profile-1");
    legacy.pragma("user_version = 1");
    legacy.close();

    const upgraded = migrateDatabase(file);
    expect(upgraded.client.pragma("user_version", { simple: true })).toBe(2);
    expect(upgraded.client.prepare("SELECT id FROM browser_profiles").all()).toEqual([{ id: "profile-1" }]);
    expect(upgraded.client.prepare("SELECT browser_profile_id FROM translation_jobs").all())
      .toEqual([{ browser_profile_id: "profile-1" }]);
    expect(upgraded.client.prepare("SELECT name FROM sqlite_master WHERE name = 'browser_profile_hosts'").get()).toBeUndefined();
    upgraded.client.close();
  });
});
