import { randomUUID } from "node:crypto";
import { mkdir, lstat, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type BrowserContext } from "playwright";
import { and, eq } from "drizzle-orm";
import { browserProfileHosts, browserProfiles, type createDatabase } from "@wct/db";
import { AppError } from "./errors.js";
import { protectBrowserContext, readRenderedPage } from "./browser-renderer.js";
import { assertPublicUrl } from "./safe-fetch.js";

type Database = ReturnType<typeof createDatabase>["db"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ProfileManager {
  private readonly busy = new Set<string>();
  private readonly loginContexts = new Map<string, BrowserContext>();

  constructor(
    private readonly db: Database,
    private readonly dataDir: string,
    private readonly executablePath?: string
  ) {}

  private directory(id: string): string {
    if (!UUID_PATTERN.test(id)) throw new AppError("invalid_profile_id", "Invalid browser profile ID");
    return resolve(this.dataDir, "browser-profiles", id);
  }

  private async checkDirectory(id: string) {
    const directory = this.directory(id);
    const info = await lstat(directory).catch(() => null);
    if (!info?.isDirectory() || info.isSymbolicLink()) {
      throw new AppError("profile_storage_invalid", "Browser profile directory is missing or invalid");
    }
    return directory;
  }

  async get(id: string) {
    this.directory(id);
    const profile = this.db.select().from(browserProfiles).where(eq(browserProfiles.id, id)).get();
    if (!profile) throw new AppError("profile_not_found", "Browser profile not found", 404);
    const hosts = this.db.select({ hostname: browserProfileHosts.hostname })
      .from(browserProfileHosts).where(eq(browserProfileHosts.profileId, id)).all()
      .map((row) => row.hostname);
    return { ...profile, hosts, busy: this.busy.has(id) };
  }

  list() {
    return this.db.select().from(browserProfiles).all().map((profile) => ({
      ...profile,
      hosts: this.db.select({ hostname: browserProfileHosts.hostname })
        .from(browserProfileHosts).where(eq(browserProfileHosts.profileId, profile.id)).all()
        .map((row) => row.hostname),
      busy: this.busy.has(profile.id)
    }));
  }

  async create(name: string, loginUrl: string) {
    const url = new URL(loginUrl);
    await assertPublicUrl(url);
    const id = randomUUID();
    const directory = this.directory(id);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    this.db.transaction((transaction) => {
      transaction.insert(browserProfiles).values({ id, name }).run();
      transaction.insert(browserProfileHosts).values({ profileId: id, hostname: url.hostname.toLowerCase() }).run();
    });
    return this.get(id);
  }

  async addAllowedHost(id: string, hostname: string) {
    await this.get(id);
    const url = new URL(`https://${hostname}`);
    if (url.hostname.toLowerCase() !== hostname.toLowerCase() || url.port) {
      throw new AppError("invalid_host", "Provide a hostname without a scheme or port");
    }
    await assertPublicUrl(url);
    this.db.insert(browserProfileHosts).values({ profileId: id, hostname: hostname.toLowerCase() })
      .onConflictDoNothing().run();
    return this.get(id);
  }

  private claim(id: string) {
    if (this.busy.has(id)) throw new AppError("profile_busy", "This profile is already in use", 409);
    this.busy.add(id);
  }

  async openLogin(id: string, loginUrl: string) {
    const profile = await this.get(id);
    const url = new URL(loginUrl);
    await assertPublicUrl(url);
    if (!profile.hosts.includes(url.hostname.toLowerCase())) {
      throw new AppError("host_not_allowed", "Add this website to the profile first", 403);
    }
    this.claim(id);
    try {
      const directory = await this.checkDirectory(id);
      const context = await chromium.launchPersistentContext(directory, {
        headless: false,
        acceptDownloads: false,
        executablePath: this.executablePath || undefined
      });
      this.loginContexts.set(id, context);
      context.on("close", () => {
        this.loginContexts.delete(id);
        this.busy.delete(id);
      });
      await protectBrowserContext(context);
      const page = context.pages()[0] ?? await context.newPage();
      await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      return { id, status: "login_open" as const };
    } catch (error) {
      const context = this.loginContexts.get(id);
      if (context) await context.close().catch(() => undefined);
      this.loginContexts.delete(id);
      this.busy.delete(id);
      throw error;
    }
  }

  async completeLogin(id: string) {
    await this.get(id);
    const context = this.loginContexts.get(id);
    if (!context) throw new AppError("login_not_open", "No login browser is open for this profile", 409);
    this.db.update(browserProfiles).set({ status: "ready", lastUsedAt: new Date().toISOString() })
      .where(eq(browserProfiles.id, id)).run();
    await context.close();
    return this.get(id);
  }

  async render(id: string, input: { url: string; timeoutMs: number; maxBytes: number }) {
    const profile = await this.get(id);
    const url = new URL(input.url);
    await assertPublicUrl(url);
    if (!profile.hosts.includes(url.hostname.toLowerCase())) {
      throw new AppError("host_not_allowed", "This URL is not allowed for the selected profile", 403);
    }
    if (profile.status !== "ready") {
      throw new AppError("reauth_required", "Open this profile and complete login first", 409);
    }
    this.claim(id);
    let context: BrowserContext | undefined;
    try {
      const directory = await this.checkDirectory(id);
      context = await chromium.launchPersistentContext(directory, {
        headless: true,
        acceptDownloads: false,
        executablePath: this.executablePath || undefined,
        serviceWorkers: "block"
      });
      await protectBrowserContext(context);
      const result = await readRenderedPage({
        ...input,
        context,
        allowedMainHosts: profile.hosts
      });
      this.db.update(browserProfiles).set({ lastUsedAt: new Date().toISOString() })
        .where(eq(browserProfiles.id, id)).run();
      return result;
    } catch (error) {
      if (error instanceof AppError && error.code === "reauth_required") {
        this.db.update(browserProfiles).set({ status: "reauth_required" })
          .where(eq(browserProfiles.id, id)).run();
      }
      throw error;
    } finally {
      await context?.close().catch(() => undefined);
      this.busy.delete(id);
    }
  }

  async delete(id: string) {
    await this.get(id);
    if (this.busy.has(id)) throw new AppError("profile_busy", "Close the profile browser before deleting", 409);
    const directory = await this.checkDirectory(id);
    await rm(directory, { recursive: true, force: false });
    this.db.delete(browserProfiles).where(eq(browserProfiles.id, id)).run();
  }

  async closeAll() {
    await Promise.all([...this.loginContexts.values()].map((context) => context.close().catch(() => undefined)));
  }
}
