import { mkdir, lstat, rm, readdir, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, devices, type BrowserContext } from "playwright";
import { eq } from "drizzle-orm";
import { browserProfile, type createDatabase } from "@wct/db";
import type { BrowserProfileState } from "@wct/core";
import { AppError } from "./errors.js";
import { protectBrowserContext, readRenderedPage } from "./browser-renderer.js";
import { assertPublicUrl } from "./safe-fetch.js";

type Database = ReturnType<typeof createDatabase>["db"];
export type BrowserMode = "desktop" | "mobile";
const browserOptions = (mode: BrowserMode) => (mode === "mobile" ? devices["Pixel 9"] : {});

export class ProfileManager {
  private busy = false;
  private loginContext: BrowserContext | null = null;

  constructor(
    private readonly db: Database,
    private readonly dataDir: string,
    private readonly executablePath?: string
  ) {}

  private directory(): string {
    return resolve(this.dataDir, "browser-profile");
  }

  private async checkDirectory(): Promise<string> {
    const targetDir = this.directory();
    const info = await lstat(targetDir).catch(() => null);
    if (!info) {
      // Migrate from legacy browser-profiles/<uuid> if present
      const legacyDir = resolve(this.dataDir, "browser-profiles");
      const legacyEntries = await readdir(legacyDir).catch(() => []);
      const firstLegacy = legacyEntries[0];
      if (firstLegacy) {
        const legacyPath = resolve(legacyDir, firstLegacy);
        await rename(legacyPath, targetDir).catch(() => null);
      }
    }

    await mkdir(targetDir, { recursive: true, mode: 0o700 });
    const finalInfo = await lstat(targetDir).catch(() => null);
    if (!finalInfo?.isDirectory() || finalInfo.isSymbolicLink()) {
      throw new AppError("profile_storage_invalid", "Browser profile directory is missing or invalid");
    }
    return targetDir;
  }

  async getState(): Promise<BrowserProfileState> {
    let record = this.db.select().from(browserProfile).where(eq(browserProfile.id, "default")).get();
    if (!record) {
      this.db.insert(browserProfile).values({ id: "default", status: "new" }).onConflictDoNothing().run();
      record = this.db.select().from(browserProfile).where(eq(browserProfile.id, "default")).get();
    }
    return {
      status: record?.status ?? "new",
      busy: this.busy,
      createdAt: record?.createdAt,
      lastUsedAt: record?.lastUsedAt
    };
  }

  private claim() {
    if (this.busy) throw new AppError("profile_busy", "The browser profile is already in use", 409);
    this.busy = true;
  }

  async openLogin(loginUrl: string, mode: BrowserMode = "desktop") {
    const url = new URL(loginUrl);
    await assertPublicUrl(url);
    this.claim();
    try {
      const directory = await this.checkDirectory();
      const context = await chromium.launchPersistentContext(directory, {
        headless: false,
        acceptDownloads: false,
        executablePath: this.executablePath || undefined,
        ...browserOptions(mode)
      });
      this.loginContext = context;
      context.on("close", () => {
        this.loginContext = null;
        this.busy = false;
      });
      await protectBrowserContext(context);
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      return { status: "login_open" as const };
    } catch (error) {
      if (this.loginContext) {
        await this.loginContext.close().catch(() => undefined);
        this.loginContext = null;
      }
      this.busy = false;
      throw error;
    }
  }

  async completeLogin(): Promise<BrowserProfileState> {
    if (!this.loginContext) {
      throw new AppError("login_not_open", "No login browser is open for the profile", 409);
    }
    this.db
      .update(browserProfile)
      .set({ status: "ready", lastUsedAt: new Date().toISOString() })
      .where(eq(browserProfile.id, "default"))
      .run();
    await this.loginContext.close();
    this.loginContext = null;
    this.busy = false;
    return this.getState();
  }

  async render(input: { url: string; timeoutMs: number; maxBytes: number; mode?: BrowserMode }) {
    const state = await this.getState();
    const url = new URL(input.url);
    await assertPublicUrl(url);
    if (state.status !== "ready") {
      throw new AppError("reauth_required", "Open the browser profile and complete login first", 409);
    }
    this.claim();
    let context: BrowserContext | undefined;
    try {
      const directory = await this.checkDirectory();
      context = await chromium.launchPersistentContext(directory, {
        headless: true,
        acceptDownloads: false,
        executablePath: this.executablePath || undefined,
        serviceWorkers: "block",
        ...browserOptions(input.mode ?? "desktop")
      });
      await protectBrowserContext(context);
      const result = await readRenderedPage({
        ...input,
        context
      });
      this.db
        .update(browserProfile)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(browserProfile.id, "default"))
        .run();
      return result;
    } catch (error) {
      if (error instanceof AppError && error.code === "reauth_required") {
        this.db
          .update(browserProfile)
          .set({ status: "reauth_required" })
          .where(eq(browserProfile.id, "default"))
          .run();
      }
      throw error;
    } finally {
      await context?.close().catch(() => undefined);
      this.busy = false;
    }
  }

  async reset(): Promise<BrowserProfileState> {
    if (this.busy) {
      throw new AppError("profile_busy", "Close the browser profile before resetting", 409);
    }
    if (this.loginContext) {
      await this.loginContext.close().catch(() => undefined);
      this.loginContext = null;
    }
    const directory = this.directory();
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    this.db
      .update(browserProfile)
      .set({ status: "new", lastUsedAt: null })
      .where(eq(browserProfile.id, "default"))
      .run();
    return this.getState();
  }

  async closeAll() {
    if (this.loginContext) {
      await this.loginContext.close().catch(() => undefined);
      this.loginContext = null;
      this.busy = false;
    }
  }
}
