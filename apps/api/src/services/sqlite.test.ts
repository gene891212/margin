import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { translationJobs } from "@wct/db";
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
    expect(second.client.pragma("user_version", { simple: true })).toBe(1);
    second.client.close();
  });
});
