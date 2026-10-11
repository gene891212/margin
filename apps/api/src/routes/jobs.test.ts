import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { translationJobs, documents, fetchAttempts, translationRuns } from "@wct/db";
import { migrateDatabase } from "@wct/db/migrate";
import { jobRoutes } from "./jobs.js";
import { ProfileManager } from "../services/profile-manager.js";

let tempDirectory: string | undefined;

afterEach(() => {
  if (tempDirectory) rmSync(tempDirectory, { recursive: true, force: true });
  tempDirectory = undefined;
});

function setupTestApp() {
  tempDirectory = mkdtempSync(join(tmpdir(), "margin-job-routes-test-"));
  const dbFile = join(tempDirectory, "app.sqlite");
  const { db, client } = migrateDatabase(dbFile);
  const profiles = new ProfileManager(db, tempDirectory, "/mock/chromium");

  const app = Fastify();
  app.register(jobRoutes, { db, profiles, dataDir: tempDirectory });
  return { app, db, client, profiles, dir: tempDirectory };
}

describe("jobRoutes retry and details", () => {
  it("retries a failed job by resetting status to queued and clearing errors", async () => {
    const { app, db, client } = setupTestApp();

    db.insert(translationJobs).values({
      id: "job-failed-1",
      sourceUrl: "https://example.com/failed",
      targetLanguage: "zh-TW",
      status: "failed",
      errorCode: "rate_limited",
      error: "Too many requests to source",
      useBrowserProfile: false,
      options: { browserMode: "desktop", imageStorageMode: "local" }
    }).run();

    db.insert(fetchAttempts).values({
      id: "attempt-1",
      jobId: "job-failed-1",
      method: "http",
      url: "https://example.com/failed",
      outcome: "failed",
      errorCode: "rate_limited"
    }).run();

    const retryRes = await app.inject({
      method: "POST",
      url: "/v1/translation-jobs/job-failed-1/retry",
      payload: {
        browserMode: "mobile"
      }
    });

    expect(retryRes.statusCode).toBe(200);
    const retryBody = retryRes.json();
    expect(retryBody).toEqual({ jobId: "job-failed-1", status: "queued" });

    // Verify database state
    const retrieved = db.select().from(translationJobs).all()[0];
    expect(retrieved).toBeDefined();
    expect(retrieved!.status).toBe("queued");
    expect(retrieved!.errorCode).toBeNull();
    expect(retrieved!.error).toBeNull();
    expect((retrieved!.options as Record<string, unknown>).browserMode).toBe("mobile");

    // Previous attempts should be cleared
    const attempts = db.select().from(fetchAttempts).all();
    expect(attempts).toHaveLength(0);

    // GET /v1/translation-jobs should return errorCode and options
    const listRes = await app.inject({
      method: "GET",
      url: "/v1/translation-jobs"
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.jobs[0].id).toBe("job-failed-1");
    expect(listBody.jobs[0].status).toBe("queued");
    expect(listBody.jobs[0].errorCode).toBeNull();
    expect(listBody.jobs[0].options).toEqual({ browserMode: "mobile", imageStorageMode: "local" });

    client.close();
  });

  it("retries a completed job, clearing old document and resetting status to queued", async () => {
    const { app, db, client } = setupTestApp();

    db.insert(translationJobs).values({
      id: "job-completed-1",
      sourceUrl: "https://example.com/article",
      targetLanguage: "zh-TW",
      status: "completed",
      useBrowserProfile: false,
      options: { browserMode: "desktop", imageStorageMode: "local" }
    }).run();

    db.insert(documents).values({
      id: "doc-1",
      jobId: "job-completed-1",
      title: "Original",
      translatedTitle: "翻譯",
      extractionConfidence: 0.95,
      documentAst: {
        version: 1,
        title: "Original",
        sourceUrl: "https://example.com/article",
        targetLanguage: "zh-TW",
        nodes: []
      }
    }).run();

    const retryRes = await app.inject({
      method: "POST",
      url: "/v1/translation-jobs/job-completed-1/retry"
    });

    expect(retryRes.statusCode).toBe(200);
    const retrieved = db.select().from(translationJobs).all()[0];
    expect(retrieved).toBeDefined();
    expect(retrieved!.status).toBe("queued");

    // Old document should be removed
    const docs = db.select().from(documents).all();
    expect(docs).toHaveLength(0);

    client.close();
  });

  it("returns 404 when retrying a non-existent job", async () => {
    const { app, client } = setupTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/translation-jobs/not-found/retry"
    });
    expect(res.statusCode).toBe(404);
    client.close();
  });
});
