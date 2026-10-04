import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DocumentAst, DocumentNode } from "@wct/core";
import { fetchAttempts, type createDatabase } from "@wct/db";
import type { AppConfig } from "../config.js";
import { textOfInline } from "../extractor/inline.js";
import { detectNextPageUrl, isSameArticleTitle } from "../extractor/pagination.js";
import { extractArticle } from "../extractor/readability.js";
import { renderHtml } from "./browser-renderer.js";
import { AppError, describeError } from "./errors.js";
import { hashText } from "./hash.js";
import type { ProfileManager } from "./profile-manager.js";
import { assertPublicUrl, safeFetchHtml } from "./safe-fetch.js";

type Database = ReturnType<typeof createDatabase>["db"];

interface SinglePageResult {
  document: DocumentAst;
  confidence: number;
  html: string;
  actualUrl: string;
}

async function fetchSinglePage(input: {
  db: Database;
  config: AppConfig;
  profiles: ProfileManager;
  jobId: string;
  url: string;
  pageIndex: number;
  targetLanguage: string;
  useBrowserProfile?: boolean;
  browserMode?: "desktop" | "mobile";
}): Promise<SinglePageResult> {
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
      snapshotPath = resolve(directory, `${input.jobId}-p${input.pageIndex}-${attempt.method}.html`);
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

  if (input.useBrowserProfile) {
    try {
      const rendered = await input.profiles.render({
        url: input.url,
        timeoutMs: config.BROWSER_TIMEOUT_MS,
        maxBytes: config.MAX_SOURCE_BYTES,
        mode: input.browserMode
      });
      const extracted = extractArticle({
        html: rendered.html,
        url: rendered.url,
        targetLanguage: input.targetLanguage
      });
      await record({ method: "profile", url: rendered.url, httpStatus: rendered.httpStatus });
      return {
        document: extracted.document,
        confidence: extracted.confidence,
        html: rendered.html,
        actualUrl: rendered.url
      };
    } catch (error) {
      await record({ method: "profile", url: input.url, error });
      throw error;
    }
  }

  if (input.browserMode === "mobile") {
    try {
      const rendered = await renderHtml({
        url: input.url,
        timeoutMs: config.BROWSER_TIMEOUT_MS,
        maxBytes: config.MAX_SOURCE_BYTES,
        executablePath: config.BROWSER_EXECUTABLE_PATH,
        mode: "mobile"
      });
      const extracted = extractArticle({
        html: rendered.html,
        url: rendered.url,
        targetLanguage: input.targetLanguage
      });
      await record({ method: "browser", url: rendered.url, html: rendered.html, httpStatus: rendered.httpStatus });
      return {
        document: extracted.document,
        confidence: extracted.confidence,
        html: rendered.html,
        actualUrl: rendered.url
      };
    } catch (error) {
      await record({ method: "browser", url: input.url, error });
      throw error;
    }
  }

  let httpFailure: unknown;
  try {
    const fetched = await safeFetchHtml(input.url, config.MAX_SOURCE_BYTES);
    await record({ method: "http", url: fetched.url, html: fetched.html });
    try {
      const extracted = extractArticle({
        html: fetched.html,
        url: fetched.url,
        targetLanguage: input.targetLanguage
      });
      return {
        document: extracted.document,
        confidence: extracted.confidence,
        html: fetched.html,
        actualUrl: fetched.url
      };
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
    return {
      document: extracted.document,
      confidence: extracted.confidence,
      html: rendered.html,
      actualUrl: rendered.url
    };
  } catch (error) {
    await record({ method: "browser", url: input.url, error });
    throw error;
  }
}

export async function loadSource(input: {
  db: Database;
  config: AppConfig;
  profiles: ProfileManager;
  jobId: string;
  url: string;
  targetLanguage: string;
  useBrowserProfile?: boolean;
  browserMode?: "desktop" | "mobile";
  maxPages?: number;
}): Promise<{ document: DocumentAst; confidence: number }> {
  const maxPages = input.maxPages ?? 5;
  const visitedUrls = new Set<string>();

  // 1. Fetch Page 1
  visitedUrls.add(input.url);
  const firstPage = await fetchSinglePage({
    ...input,
    pageIndex: 1
  });

  const mergedDocument: DocumentAst = {
    ...firstPage.document,
    nodes: [...firstPage.document.nodes]
  };

  let currentHtml = firstPage.html;
  let currentUrl = firstPage.actualUrl;
  visitedUrls.add(currentUrl);

  const existingImageUrls = new Set(
    mergedDocument.nodes.filter((n) => n.type === "image" && n.src).map((n) => n.src!)
  );

  // 2. Loop for subsequent pages up to maxPages
  let pageIndex = 1;
  while (pageIndex < maxPages) {
    const nextUrl = detectNextPageUrl({
      html: currentHtml,
      currentUrl,
      currentPageNumber: pageIndex
    });

    if (!nextUrl) break;
    if (visitedUrls.has(nextUrl)) break;

    // Safety checks: same origin and public URL
    try {
      if (new URL(nextUrl).origin !== new URL(currentUrl).origin) break;
      await assertPublicUrl(new URL(nextUrl));
    } catch {
      break;
    }

    visitedUrls.add(nextUrl);
    pageIndex++;

    let nextPageResult: SinglePageResult;
    try {
      nextPageResult = await fetchSinglePage({
        ...input,
        url: nextUrl,
        pageIndex
      });
    } catch {
      // If fetching subsequent page fails, preserve what was gathered so far
      break;
    }

    // Ensure subsequent page belongs to the same article
    if (!isSameArticleTitle(mergedDocument.title, nextPageResult.document.title)) {
      break;
    }

    // Filter duplicate hero image, title heading, and metadata from subsequent pages
    const filteredNodes: DocumentNode[] = [];
    let foundFirstNewContent = false;

    for (const node of nextPageResult.document.nodes) {
      if (!foundFirstNewContent) {
        if (node.type === "image" && node.src && existingImageUrls.has(node.src)) continue;
        const text = textOfInline(node.inline);
        if (node.type === "heading" && isSameArticleTitle(text, mergedDocument.title)) continue;
        if (node.type === "paragraph" && (/^\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(text.trim()) || text.trim().length === 0)) continue;
        if (node.type === "list") continue;
        foundFirstNewContent = true;
      }
      filteredNodes.push(node);
      if (node.type === "image" && node.src) {
        existingImageUrls.add(node.src);
      }
    }

    // Namespace node IDs to guarantee stable uniqueness across pages
    const namespacedNodes = filteredNodes.map((node) => ({
      ...node,
      id: `p${pageIndex}-${node.id}`
    }));

    // Option B: Insert subtle divider marker between pages
    const dividerNode: DocumentNode = {
      id: `page-break-${pageIndex}`,
      type: "divider",
      inline: [{ type: "text", text: `第 ${pageIndex} 頁` }],
      translatedInline: [{ type: "text", text: `第 ${pageIndex} 頁` }],
      translatable: false
    };

    mergedDocument.nodes.push(dividerNode, ...namespacedNodes);
    currentHtml = nextPageResult.html;
    currentUrl = nextPageResult.actualUrl;
    visitedUrls.add(currentUrl);
  }

  return {
    document: mergedDocument,
    confidence: firstPage.confidence
  };
}
