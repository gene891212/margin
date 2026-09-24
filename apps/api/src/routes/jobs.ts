import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { createTranslationJobSchema, documentAstSchema } from "@wct/core";
import { documents, translationJobs, translationRuns, type createDatabase } from "@wct/db";
import { AppError } from "../services/errors.js";
import type { ProfileManager } from "../services/profile-manager.js";
import { assertPublicUrl } from "../services/safe-fetch.js";

type Database = ReturnType<typeof createDatabase>["db"];

export async function jobRoutes(app: FastifyInstance, input: { db: Database; profiles: ProfileManager }) {
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
    if (parsed.data.browserProfileId) {
      const profile = await input.profiles.get(parsed.data.browserProfileId);
      if (profile.status !== "ready") {
        throw new AppError("reauth_required", "Complete login for this profile first", 409);
      }
    }

    const id = randomUUID();
    input.db.insert(translationJobs).values({
      id,
      sourceUrl: sourceUrl.toString(),
      targetLanguage: parsed.data.targetLanguage,
      browserProfileId: parsed.data.browserProfileId,
      options: { browserMode: parsed.data.browserMode }
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
      browserProfileId: job.browserProfileId,
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
}
