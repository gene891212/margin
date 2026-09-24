import { chromium, devices, type BrowserContext } from "playwright";
import { AppError } from "./errors.js";
import { assertPublicUrl } from "./safe-fetch.js";

const CHALLENGE_MARKERS = [
  "checking your browser",
  "verify you are human",
  "attention required",
  "just a moment",
  "checking if the site connection is secure"
];

export async function protectBrowserContext(context: BrowserContext): Promise<void> {
  await context.route("**/*", async (route) => {
    try {
      const url = new URL(route.request().url());
      if (["data:", "blob:"].includes(url.protocol)) return await route.continue();
      await assertPublicUrl(url);
      if (["media", "font"].includes(route.request().resourceType())) return await route.abort();
      await route.continue();
    } catch {
      await route.abort("blockedbyclient").catch(() => undefined);
    }
  });
}

export async function readRenderedPage(input: {
  context: BrowserContext;
  url: string;
  timeoutMs: number;
  maxBytes: number;
}): Promise<{ url: string; html: string; httpStatus?: number }> {
  await assertPublicUrl(new URL(input.url));
  const page = await input.context.newPage();
  try {
    const response = await page.goto(input.url, {
      waitUntil: "domcontentloaded",
      timeout: input.timeoutMs
    });
    const httpStatus = response?.status();
    if (httpStatus === 401) throw new AppError("login_required", "This page requires login", 401);
    if (httpStatus === 429) throw new AppError("rate_limited", "The site is rate limiting requests", 429);
    if (httpStatus && httpStatus >= 400) {
      throw new AppError("browser_http_error", `Rendered source returned HTTP ${httpStatus}`, httpStatus);
    }

    const finalUrl = new URL(page.url());
    await assertPublicUrl(finalUrl);

    await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => undefined);
    for (let step = 0; step < 3; step += 1) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.85));
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => window.scrollTo(0, 0));

    const bodyText = await page.locator("body").innerText().catch(() => "");
    const firstText = `${await page.title()} ${bodyText.slice(0, 1_000)}`.toLowerCase();
    if (CHALLENGE_MARKERS.some((marker) => firstText.includes(marker))) {
      throw new AppError("anti_bot_challenge", "The site presented an anti-bot challenge; it was not bypassed");
    }
    if ((await page.locator('input[type="password"]').count()) > 0 && bodyText.length < 2_000) {
      throw new AppError("reauth_required", "The page appears to require signing in again");
    }

    const html = await page.content();
    if (Buffer.byteLength(html) > input.maxBytes) {
      throw new AppError("source_too_large", "Rendered source document is too large");
    }
    return { url: finalUrl.toString(), html, httpStatus };
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function renderHtml(input: {
  url: string;
  timeoutMs: number;
  maxBytes: number;
  executablePath?: string;
  mode?: "desktop" | "mobile";
}): Promise<{ url: string; html: string; httpStatus?: number }> {
  const browser = await chromium.launch({
    headless: true,
    executablePath: input.executablePath || undefined
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new AppError("browser_unavailable", `Browser unavailable. Run "pnpm browser:install". ${message}`);
  });
  try {
    const context = await browser.newContext({
      serviceWorkers: "block",
      acceptDownloads: false,
      ...(input.mode === "mobile" ? devices["Pixel 9"] : {})
    });
    await protectBrowserContext(context);
    return await readRenderedPage({ ...input, context });
  } finally {
    await browser.close();
  }
}
