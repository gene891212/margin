import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DocumentAst } from "@wct/core";
import { fetchAttempts, type createDatabase } from "@wct/db";
import type { AppConfig } from "../config.js";
import { extractArticle } from "../extractor/readability.js";
import { renderHtml } from "./browser-renderer.js";
import { AppError, describeError } from "./errors.js";
import { hashText } from "./hash.js";
import type { ProfileManager } from "./profile-manager.js";
import { safeFetchHtml } from "./safe-fetch.js";

type Database = ReturnType<typeof createDatabase>["db"];

export async function loadSource(input: {
  db: Database;
  config: AppConfig;
  profiles: ProfileManager;
  jobId: string;
  url: string;
  targetLanguage: string;
  browserProfileId?: string | null;
}): Promise<{ document: DocumentAst; confidence: number }> {
  const { db, config } = input;
  const record = async (attempt: {
    method: "http" | "browser" | "profile";
    url: string;
    html?: string;
    httpStatus?: number;
    error?: unknown;
  }) => {
    const described = attempt.error ? describeError(attempt.error) : undefined;
    let snapshotPath: string | undefined;
    if (attempt.html && attempt.method !== "profile") {
      const directory = resolve(config.DATA_DIR, "snapshots");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      snapshotPath = resolve(directory, `${input.jobId}-${attempt.method}.html`);
      await writeFile(snapshotPath, attempt.html, { mode: 0o600 });
    }
    db.insert(fetchAttempts).values({
      id: randomUUID(),
      jobId: input.jobId,
      method: attempt.method,
      url: attempt.url,
      outcome: described ? "failed" : "success",
      httpStatus: attempt.httpStatus,
      errorCode: described?.code,
      error: described?.message.slice(0, 1_000),
      snapshotPath,
      contentHash: attempt.html && attempt.method !== "profile" ? hashText(attempt.html) : undefined,
      byteLength: attempt.html && attempt.method !== "profile" ? Buffer.byteLength(attempt.html) : undefined
    }).run();
  };

  if (input.browserProfileId) {
    try {
      const rendered = await input.profiles.render(input.browserProfileId, {
        url: input.url,
        timeoutMs: config.BROWSER_TIMEOUT_MS,
        maxBytes: config.MAX_SOURCE_BYTES
      });
      const extracted = extractArticle({
        html: rendered.html,
        url: rendered.url,
        targetLanguage: input.targetLanguage
      });
      await record({ method: "profile", url: rendered.url, httpStatus: rendered.httpStatus });
      return extracted;
    } catch (error) {
      await record({ method: "profile", url: input.url, error });
      throw error;
    }
  }

  let httpFailure: unknown;
  try {
    const fetched = await safeFetchHtml(input.url, config.MAX_SOURCE_BYTES);
    await record({ method: "http", url: fetched.url, html: fetched.html });
    try {
      return extractArticle({
        html: fetched.html,
        url: fetched.url,
        targetLanguage: input.targetLanguage
      });
    } catch (error) {
      httpFailure = error;
    }
  } catch (error) {
    await record({ method: "http", url: input.url, error });
    httpFailure = error;
  }

  if (httpFailure instanceof AppError && ["login_required", "rate_limited", "url_not_allowed", "source_too_large"].includes(httpFailure.code)) {
    throw httpFailure;
  }
  if (!config.BROWSER_FALLBACK_ENABLED) {
    throw httpFailure instanceof Error ? httpFailure : new AppError("extraction_failed", "Main article content was not found");
  }

  try {
    const rendered = await renderHtml({
      url: input.url,
      timeoutMs: config.BROWSER_TIMEOUT_MS,
      maxBytes: config.MAX_SOURCE_BYTES,
      executablePath: config.BROWSER_EXECUTABLE_PATH
    });
    const extracted = extractArticle({
      html: rendered.html,
      url: rendered.url,
      targetLanguage: input.targetLanguage
    });
    await record({ method: "browser", url: rendered.url, html: rendered.html, httpStatus: rendered.httpStatus });
    return extracted;
  } catch (error) {
    await record({ method: "browser", url: input.url, error });
    throw error;
  }
}
