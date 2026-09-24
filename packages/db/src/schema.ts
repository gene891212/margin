import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () => text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const browserProfile = sqliteTable("browser_profile", {
  id: text("id").primaryKey().default("default"),
  status: text("status", { enum: ["new", "ready", "reauth_required"] }).notNull().default("new"),
  createdAt: createdAt(),
  lastUsedAt: text("last_used_at")
});

export const translationJobs = sqliteTable("translation_jobs", {
  id: text("id").primaryKey(),
  sourceUrl: text("source_url").notNull(),
  targetLanguage: text("target_language").notNull(),
  useBrowserProfile: integer("use_browser_profile", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["queued", "fetching", "extracting", "translating", "completed", "failed"] }).notNull().default("queued"),
  options: text("options", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  errorCode: text("error_code"),
  error: text("error"),
  createdAt: createdAt(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at")
}, (table) => [index("jobs_status_created_idx").on(table.status, table.createdAt)]);

export const fetchAttempts = sqliteTable("fetch_attempts", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().references(() => translationJobs.id, { onDelete: "cascade" }),
  method: text("method", { enum: ["http", "browser", "profile"] }).notNull(),
  url: text("url").notNull(),
  outcome: text("outcome", { enum: ["success", "failed"] }).notNull(),
  httpStatus: integer("http_status"),
  errorCode: text("error_code"),
  error: text("error"),
  snapshotPath: text("snapshot_path"),
  contentHash: text("content_hash"),
  byteLength: integer("byte_length"),
  createdAt: createdAt()
}, (table) => [index("fetch_job_idx").on(table.jobId)]);

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().unique().references(() => translationJobs.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  translatedTitle: text("translated_title"),
  sourceLanguage: text("source_language"),
  documentAst: text("document_ast", { mode: "json" }).$type<unknown>().notNull(),
  extractionConfidence: real("extraction_confidence").notNull(),
  createdAt: createdAt()
});

export const segments = sqliteTable("segments", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  stableKey: text("stable_key").notNull(),
  sequence: integer("sequence").notNull(),
  nodeType: text("node_type").notNull(),
  sourceText: text("source_text").notNull(),
  sourceHash: text("source_hash").notNull(),
  translatable: integer("translatable", { mode: "boolean" }).notNull().default(true)
}, (table) => [
  uniqueIndex("segments_document_key_idx").on(table.documentId, table.stableKey),
  index("segments_source_hash_idx").on(table.sourceHash)
]);

export const translationRuns = sqliteTable("translation_runs", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().references(() => translationJobs.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  model: text("model"),
  strategy: text("strategy").notNull(),
  characterCount: integer("character_count").notNull(),
  durationMs: integer("duration_ms"),
  outcome: text("outcome", { enum: ["success", "failed"] }).notNull(),
  error: text("error"),
  createdAt: createdAt()
});

export const translations = sqliteTable("translations", {
  id: text("id").primaryKey(),
  segmentId: text("segment_id").notNull().references(() => segments.id, { onDelete: "cascade" }),
  targetLanguage: text("target_language").notNull(),
  translatedText: text("translated_text").notNull(),
  provider: text("provider").notNull(),
  model: text("model"),
  qualityStatus: text("quality_status").notNull().default("unreviewed"),
  createdAt: createdAt()
}, (table) => [uniqueIndex("translation_segment_language_idx").on(table.segmentId, table.targetLanguage)]);
