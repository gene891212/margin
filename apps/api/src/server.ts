import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { eq } from "drizzle-orm";
import type { TranslationProvider } from "@wct/core";
import { documents, translationJobs } from "@wct/db";
import { migrateDatabase } from "@wct/db/migrate";
import { loadConfig } from "./config.js";
import { jobRoutes } from "./routes/jobs.js";
import { profileRoutes } from "./routes/profiles.js";
import { describeError } from "./services/errors.js";
import { ProfileManager } from "./services/profile-manager.js";
import { MockTranslationProvider, OpenAITranslationProvider } from "./services/translation.js";
import { WholeDocumentTranslationStrategy } from "./services/translation-strategy.js";
import { startWorker } from "./worker/runner.js";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
try { process.loadEnvFile(resolve(projectRoot, ".env")); } catch { /* .env is optional. */ }
const config = loadConfig();
config.DATA_DIR = resolve(projectRoot, config.DATA_DIR);
config.DATABASE_FILE = resolve(projectRoot, config.DATABASE_FILE);
const webOrigin = new URL(config.WEB_ORIGIN);
const allowedWebOrigins = new Set([webOrigin.origin]);
if (["localhost", "127.0.0.1"].includes(webOrigin.hostname)) {
  for (const hostname of ["localhost", "127.0.0.1"]) {
    allowedWebOrigins.add(`${webOrigin.protocol}//${hostname}${webOrigin.port ? `:${webOrigin.port}` : ""}`);
  }
}

const { db, client } = migrateDatabase(config.DATABASE_FILE);
const profiles = new ProfileManager(db, config.DATA_DIR, config.BROWSER_EXECUTABLE_PATH);
const provider: TranslationProvider = config.TRANSLATION_PROVIDER === "openai"
  ? new OpenAITranslationProvider(config.OPENAI_API_KEY!, config.OPENAI_MODEL!)
  : new MockTranslationProvider();
const translationStrategy = new WholeDocumentTranslationStrategy(config.MAX_TRANSLATION_CHARACTERS);

for (const job of db.select().from(translationJobs).all()) {
  if (["fetching", "extracting", "translating"].includes(job.status)) {
    const document = db.select({ id: documents.id }).from(documents)
      .where(eq(documents.jobId, job.id)).get();
    db.update(translationJobs).set({
      status: document ? "completed" : "queued",
      updatedAt: new Date().toISOString()
    }).where(eq(translationJobs.id, job.id)).run();
  }
}

const app = Fastify({ logger: true, bodyLimit: 64 * 1024 });
app.log.info({ provider: provider.name, model: provider.model ?? null }, "Translation provider ready");
await app.register(cors, {
  origin: (origin, callback) => callback(null, !origin || allowedWebOrigins.has(origin))
});
app.addHook("onRequest", async (request, reply) => {
  const host = request.headers.host?.split(":")[0]?.toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1") {
    return reply.code(403).send({ error: "invalid_host" });
  }
  const origin = request.headers.origin;
  if (origin && !allowedWebOrigins.has(origin)) {
    return reply.code(403).send({ error: "invalid_origin" });
  }
});
app.setErrorHandler((error, request, reply) => {
  const detail = describeError(error);
  if (detail.code === "unexpected_error") request.log.error(error);
  reply.code(detail.httpStatus ?? (detail.code === "unexpected_error" ? 500 : 400))
    .send({ error: detail.code, message: detail.message });
});
await app.register(jobRoutes, { db, profiles });
await app.register(profileRoutes, { profiles });
app.get("/health", async () => ({ ok: true, translationProvider: provider.name }));

const stopWorker = startWorker({
  db, config, profiles, provider, translationStrategy,
  onError: (error) => app.log.error(error, "Worker error")
});

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  stopWorker();
  await profiles.closeAll();
  await app.close();
  client.close();
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: "127.0.0.1", port: config.API_PORT });
