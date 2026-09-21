import type { TranslationExecutionStrategy, TranslationProvider } from "@wct/core";
import type { createDatabase } from "@wct/db";
import type { AppConfig } from "../config.js";
import type { ProfileManager } from "../services/profile-manager.js";
import { claimNextJob, processJob } from "./process-job.js";

type Database = ReturnType<typeof createDatabase>["db"];

export function startWorker(input: {
  db: Database;
  config: AppConfig;
  profiles: ProfileManager;
  provider: TranslationProvider;
  translationStrategy: TranslationExecutionStrategy;
  onError: (error: unknown) => void;
}) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const job = await claimNextJob(input.db);
      if (job) await processJob({ ...input, job });
    } catch (error) {
      input.onError(error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void run(), 1_000);
  void run();
  return () => clearInterval(timer);
}
