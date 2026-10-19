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

  it("handles document category and tags in list, get, and patch endpoints", async () => {
    const { app, db, client } = setupTestApp();

    db.insert(translationJobs).values({
      id: "job-cat-1",
      sourceUrl: "https://example.com/milet",
      targetLanguage: "zh-TW",
      status: "completed"
    }).run();

    db.insert(documents).values({
      id: "doc-cat-1",
      jobId: "job-cat-1",
      title: "milet Diary",
      translatedTitle: "milet 日記",
      extractionConfidence: 1.0,
      category: "milet",
      tags: ["Fan Club", "日記"],
      documentAst: {
        version: 1,
        title: "milet Diary",
        sourceUrl: "https://example.com/milet",
        targetLanguage: "zh-TW",
        nodes: []
      }
    }).run();

    // 1. GET /v1/translation-jobs should return category and tags
    const listRes = await app.inject({ method: "GET", url: "/v1/translation-jobs" });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    const jobItem = listBody.jobs.find((j: { id: string }) => j.id === "job-cat-1");
    expect(jobItem).toBeDefined();
    expect(jobItem.category).toBe("milet");
    expect(jobItem.tags).toEqual(["Fan Club", "日記"]);

    // 2. GET /v1/documents/:id should return category and tags
    const getRes = await app.inject({ method: "GET", url: "/v1/documents/doc-cat-1" });
    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json();
    expect(getBody.category).toBe("milet");
    expect(getBody.tags).toEqual(["Fan Club", "日記"]);
    expect(getBody.document.category).toBe("milet");
    expect(getBody.document.tags).toEqual(["Fan Club", "日記"]);

    // 3. PATCH /v1/documents/:id should update category and tags
    const patchRes = await app.inject({
      method: "PATCH",
      url: "/v1/documents/doc-cat-1",
      payload: {
        category: "milet",
        tags: ["Fan Club", "LIVE", "武道館"]
      }
    });
    expect(patchRes.statusCode).toBe(200);
    const patchBody = patchRes.json();
    expect(patchBody.category).toBe("milet");
    expect(patchBody.tags).toEqual(["Fan Club", "LIVE", "武道館"]);

    // Verify after patch
    const getRes2 = await app.inject({ method: "GET", url: "/v1/documents/doc-cat-1" });
    expect(getRes2.json().tags).toEqual(["Fan Club", "LIVE", "武道館"]);

    client.close();
  });
});
