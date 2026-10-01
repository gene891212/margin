import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { TranslationExecutionStrategy, TranslationProvider } from "@wct/core";
import {
  documents,
  segments,
  translationJobs,
  translationRuns,
  translations,
  type createDatabase
} from "@wct/db";
import type { AppConfig } from "../config.js";
import { applyTranslations, translationUnits } from "../services/document-translator.js";
import { describeError } from "../services/errors.js";
import { hashText } from "../services/hash.js";
import type { ProfileManager } from "../services/profile-manager.js";
import { loadSource } from "../services/source-loader.js";
import { downloadAndLocalizeImages } from "../services/asset-storage.js";

type Database = ReturnType<typeof createDatabase>["db"];

function setStatus(
  db: Database,
  id: string,
  status: "fetching" | "extracting" | "translating" | "completed" | "failed",
  extra: { errorCode?: string; error?: string; completedAt?: string } = {}
) {
  db.update(translationJobs).set({ status, updatedAt: new Date().toISOString(), ...extra })
    .where(eq(translationJobs.id, id)).run();
}

export async function processJob(input: {
  db: Database;
  config: AppConfig;
  profiles: ProfileManager;
  provider: TranslationProvider;
  translationStrategy: TranslationExecutionStrategy;
  job: typeof translationJobs.$inferSelect;
}) {
  const { db, config, profiles, provider, translationStrategy, job } = input;
  try {
    setStatus(db, job.id, "fetching");
    const extracted = await loadSource({
      db, config, profiles,
      jobId: job.id,
      url: job.sourceUrl,
      targetLanguage: job.targetLanguage,
      useBrowserProfile: job.useBrowserProfile,
      browserMode: job.options.browserMode === "mobile" ? "mobile" : "desktop"
    });
    setStatus(db, job.id, "extracting");
    const units = translationUnits(extracted.document);
    setStatus(db, job.id, "translating");

    const started = Date.now();
    let translated;
    try {
      translated = await translationStrategy.execute({
        provider,
        sourceLanguage: extracted.document.sourceLanguage,
        targetLanguage: extracted.document.targetLanguage,
        documentContext: {
          title: extracted.document.title,
          siteName: extracted.document.siteName,
          byline: extracted.document.byline
        },
        segments: units
      });
      db.insert(translationRuns).values({
        id: randomUUID(), jobId: job.id, provider: provider.name, model: provider.model,
        strategy: translationStrategy.name,
        characterCount: units.reduce((sum, item) => sum + item.text.length, 0),
        durationMs: Date.now() - started, outcome: "success"
      }).run();
    } catch (error) {
      db.insert(translationRuns).values({
        id: randomUUID(), jobId: job.id, provider: provider.name, model: provider.model,
        strategy: translationStrategy.name,
        characterCount: units.reduce((sum, item) => sum + item.text.length, 0),
        durationMs: Date.now() - started, outcome: "failed",
        error: describeError(error).message.slice(0, 1_000)
      }).run();
      throw error;
    }

    const translatedMap = new Map(translated.map((item) => [item.id, item.text]));
    let finalDocument = applyTranslations(extracted.document, translatedMap);

    const imageStorageMode = (job.options as Record<string, unknown>)?.imageStorageMode;
    if (imageStorageMode !== "proxy") {
      finalDocument = await downloadAndLocalizeImages({
        document: finalDocument,
        baseUrl: job.sourceUrl,
        dataDir: config.DATA_DIR
      });
    }

    db.transaction((transaction) => {
      const documentId = randomUUID();
      transaction.insert(documents).values({
        id: documentId,
        jobId: job.id,
        title: finalDocument.title,
        translatedTitle: finalDocument.translatedTitle,
        sourceLanguage: finalDocument.sourceLanguage,
        documentAst: finalDocument,
        extractionConfidence: extracted.confidence
      }).run();

      for (const [sequence, unit] of units.entries()) {
        const segmentId = randomUUID();
        transaction.insert(segments).values({
          id: segmentId,
          documentId,
          stableKey: unit.id,
          sequence,
          nodeType: unit.id === "document-title" ? "title" : "content",
          sourceText: unit.text,
          sourceHash: hashText(unit.text),
          translatable: true
        }).run();
        transaction.insert(translations).values({
          id: randomUUID(),
          segmentId,
          targetLanguage: job.targetLanguage,
          translatedText: translatedMap.get(unit.id)!,
          provider: provider.name,
          model: provider.model
        }).run();
      }
    });
    setStatus(db, job.id, "completed", { completedAt: new Date().toISOString() });
  } catch (error) {
    const details = describeError(error);
    setStatus(db, job.id, "failed", {
      errorCode: details.code,
      error: details.message.slice(0, 2_000)
    });
  }
}

export function claimNextJob(db: Database) {
  const candidate = db.select().from(translationJobs)
    .where(eq(translationJobs.status, "queued"))
    .orderBy(translationJobs.createdAt).limit(1).get();
  if (!candidate) return null;
  return db.update(translationJobs).set({ status: "fetching", updatedAt: new Date().toISOString() })
    .where(and(eq(translationJobs.id, candidate.id), eq(translationJobs.status, "queued")))
    .returning().get() ?? null;
}
