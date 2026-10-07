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
    expect(second.client.pragma("user_version", { simple: true })).toBe(3);
    second.client.close();
  });

  it("upgrades a v1 profile to singleton profile without losing its jobs", () => {
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
    expect(upgraded.client.pragma("user_version", { simple: true })).toBe(3);
    expect(upgraded.client.prepare("SELECT id, status FROM browser_profile").all()).toEqual([{ id: "default", status: "ready" }]);
    expect(upgraded.client.prepare("SELECT use_browser_profile FROM translation_jobs").all())
      .toEqual([{ use_browser_profile: 1 }]);
    expect(upgraded.client.prepare("SELECT name FROM sqlite_master WHERE name = 'browser_profile_hosts'").get()).toBeUndefined();
    expect(upgraded.client.prepare("SELECT name FROM sqlite_master WHERE name = 'browser_profiles'").get()).toBeUndefined();
    upgraded.client.close();
  });

  it("cascade-deletes documents and fetch attempts when a job is deleted", () => {
    tempDirectory = mkdtempSync(join(tmpdir(), "margin-db-test-"));
    const file = join(tempDirectory, "app.sqlite");
    const { db, client } = migrateDatabase(file);
    const { documents, fetchAttempts } = require("@wct/db");

    db.insert(translationJobs).values({
      id: "job-del", sourceUrl: "https://example.com/del", targetLanguage: "zh-TW"
    }).run();
    db.insert(documents).values({
      id: "doc-del", jobId: "job-del", title: "Test Doc", documentAst: { title: "Test", nodes: [] }, extractionConfidence: 1.0
    }).run();
    db.insert(fetchAttempts).values({
      id: "attempt-del", jobId: "job-del", method: "http", url: "https://example.com/del", outcome: "success"
    }).run();

    expect(db.select().from(documents).all()).toHaveLength(1);
    expect(db.select().from(fetchAttempts).all()).toHaveLength(1);

    const { eq } = require("drizzle-orm");
    db.delete(translationJobs).where(eq(translationJobs.id, "job-del")).run();

    expect(db.select().from(translationJobs).all()).toHaveLength(0);
    expect(db.select().from(documents).all()).toHaveLength(0);
    expect(db.select().from(fetchAttempts).all()).toHaveLength(0);
    client.close();
  });
});
