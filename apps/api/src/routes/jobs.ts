import { createReadStream } from "node:fs";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { createTranslationJobSchema, documentAstSchema } from "@wct/core";
import { documents, translationJobs, translationRuns, type createDatabase } from "@wct/db";
import { AppError } from "../services/errors.js";
import type { ProfileManager } from "../services/profile-manager.js";
import { assertPublicUrl } from "../services/safe-fetch.js";
import { getAssetPath, getAssetStats, clearAssetCache } from "../services/asset-storage.js";

type Database = ReturnType<typeof createDatabase>["db"];

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif"
};

export async function jobRoutes(app: FastifyInstance, input: { db: Database; profiles: ProfileManager; dataDir: string }) {
  app.get("/v1/translation-jobs", async () => {
    const rows = input.db.select({
      id: translationJobs.id,
      sourceUrl: translationJobs.sourceUrl,
      targetLanguage: translationJobs.targetLanguage,
      status: translationJobs.status,
      error: translationJobs.error,
      createdAt: translationJobs.createdAt,
      documentId: documents.id,
      title: documents.title,
      translatedTitle: documents.translatedTitle
    }).from(translationJobs)
      .leftJoin(documents, eq(documents.jobId, translationJobs.id))
      .orderBy(desc(translationJobs.createdAt))
      .limit(30).all();
    return {
      jobs: rows.map((row) => ({
        ...row,
        provider: input.db.select({ provider: translationRuns.provider })
          .from(translationRuns)
          .where(and(eq(translationRuns.jobId, row.id), eq(translationRuns.outcome, "success")))
          .limit(1).get()?.provider ?? null
      }))
    };
  });

  app.post("/v1/translation-jobs", async (request, reply) => {
    const parsed = createTranslationJobSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    const sourceUrl = new URL(parsed.data.source.url);
    await assertPublicUrl(sourceUrl);
    if (parsed.data.useBrowserProfile) {
      const profile = await input.profiles.getState();
      if (profile.status !== "ready") {
        throw new AppError("reauth_required", "Complete login for the browser profile first", 409);
      }
    }

    const id = randomUUID();
    input.db.insert(translationJobs).values({
      id,
      sourceUrl: sourceUrl.toString(),
      targetLanguage: parsed.data.targetLanguage,
      useBrowserProfile: parsed.data.useBrowserProfile,
      options: {
        browserMode: parsed.data.browserMode,
        imageStorageMode: parsed.data.imageStorageMode
      }
    }).run();
    return reply.code(202).send({ jobId: id, status: "queued" });
  });

  app.get<{ Params: { id: string } }>("/v1/translation-jobs/:id", async (request, reply) => {
    const job = input.db.select().from(translationJobs)
      .where(eq(translationJobs.id, request.params.id)).get();
    if (!job) return reply.code(404).send({ error: "job_not_found" });
    const document = job.status === "completed"
      ? input.db.select({ id: documents.id }).from(documents)
        .where(eq(documents.jobId, job.id)).get()
      : undefined;
    return {
      id: job.id,
      sourceUrl: job.sourceUrl,
      targetLanguage: job.targetLanguage,
      useBrowserProfile: job.useBrowserProfile,
      status: job.status,
      errorCode: job.errorCode,
      error: job.error,
      documentId: document?.id,
      createdAt: job.createdAt,
      completedAt: job.completedAt
    };
  });

  app.get<{ Params: { id: string } }>("/v1/documents/:id", async (request, reply) => {
    const record = input.db.select().from(documents)
      .where(eq(documents.id, request.params.id)).get();
    if (!record) return reply.code(404).send({ error: "document_not_found" });
    const parsed = documentAstSchema.safeParse(record.documentAst);
    if (!parsed.success) {
      request.log.error(parsed.error, "Stored document failed schema validation");
      return reply.code(500).send({ error: "invalid_stored_document" });
    }
    const run = input.db.select({ provider: translationRuns.provider })
      .from(translationRuns)
      .where(and(eq(translationRuns.jobId, record.jobId), eq(translationRuns.outcome, "success")))
      .limit(1).get();
    return {
      id: record.id,
      extractionConfidence: record.extractionConfidence,
      document: { ...parsed.data, translationProvider: run?.provider ?? null }
    };
  });

  app.get<{ Querystring: { url?: string } }>("/v1/image-proxy", async (request, reply) => {
    const rawUrl = request.query.url;
    if (!rawUrl) return reply.code(400).send({ error: "missing_url" });
    try {
      const target = new URL(rawUrl);
      await assertPublicUrl(target);
      const response = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
          "Referer": `${target.protocol}//${target.hostname}/`,
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        }
      });
      if (!response.ok) {
        return reply.code(response.status).send({ error: "image_fetch_failed" });
      }
      const contentType = response.headers.get("content-type") || "image/jpeg";
      const buffer = Buffer.from(await response.arrayBuffer());
      return reply
        .header("Content-Type", contentType)
        .header("Cache-Control", "public, max-age=86400, immutable")
        .header("Cross-Origin-Resource-Policy", "cross-origin")
        .send(buffer);
    } catch (err) {
      return reply.code(400).send({ error: "invalid_url", message: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get<{ Params: { "*": string } }>("/v1/assets/*", async (request, reply) => {
    const rawPath = request.params["*"];
    if (!rawPath) return reply.code(400).send({ error: "missing_filename" });
    const filePath = getAssetPath(rawPath, input.dataDir);
    if (!filePath) return reply.code(404).send({ error: "asset_not_found" });
    const ext = extname(filePath).toLowerCase();
    const contentType = EXT_TO_MIME[ext] || "application/octet-stream";
    const stream = createReadStream(filePath);
    return reply
      .header("Content-Type", contentType)
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("Cross-Origin-Resource-Policy", "cross-origin")
      .send(stream);
  });

  app.get("/v1/assets/stats", async () => {
    return getAssetStats(input.dataDir);
  });

  app.delete("/v1/assets", async () => {
    return clearAssetCache(input.dataDir);
  });
}
