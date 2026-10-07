import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import type { DocumentAst } from "@wct/core";
import { assertPublicUrl } from "./safe-fetch.js";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/avif": ".avif"
};

function getExtension(contentType: string | null, urlPath: string): string {
  if (contentType) {
    const cleanType = contentType.split(";")[0]?.trim().toLowerCase();
    if (cleanType && MIME_TO_EXT[cleanType]) return MIME_TO_EXT[cleanType];
  }
  const rawExt = extname(urlPath).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"].includes(rawExt)) {
    return rawExt === ".jpeg" ? ".jpg" : rawExt;
  }
  return ".jpg";
}

export function ensureAssetsDir(dataDir: string, subDir?: string): string {
  const assetsDir = subDir ? resolve(dataDir, "assets", subDir) : resolve(dataDir, "assets");
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }
  return assetsDir;
}

export async function downloadAndLocalizeImages(input: {
  document: DocumentAst;
  baseUrl: string;
  dataDir: string;
  documentId?: string;
}): Promise<DocumentAst> {
  const { document, baseUrl, dataDir, documentId } = input;
  const targetDir = ensureAssetsDir(dataDir, documentId);

  if (documentId) {
    const infoPath = resolve(targetDir, "info.txt");
    if (!existsSync(infoPath)) {
      const infoContent = [
        `標題: ${document.title}`,
        `譯文標題: ${document.translatedTitle ?? "無"}`,
        `來源網址: ${baseUrl}`,
        `文件 ID: ${documentId}`,
        `儲存時間: ${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}`
      ].join("\n");
      try {
        writeFileSync(infoPath, infoContent, "utf-8");
      } catch {}
    }
  }

  const updatedNodes = await Promise.all(
    document.nodes.map(async (node) => {
      if (node.type !== "image" || !node.src) return node;
      if (node.src.startsWith("data:")) return node;

      if (documentId && node.src.startsWith(`/v1/assets/${documentId}/`)) return node;
      if (!documentId && node.src.startsWith("/v1/assets/")) return node;

      // Migrate from old flat asset path if moving into document folder
      if (documentId && node.src.startsWith("/v1/assets/")) {
        const oldFilename = basename(node.src);
        const oldPath = resolve(dataDir, "assets", oldFilename);
        const newPath = resolve(targetDir, oldFilename);
        if (existsSync(oldPath)) {
          if (!existsSync(newPath)) {
            copyFileSync(oldPath, newPath);
          }
          return {
            ...node,
            src: `/v1/assets/${documentId}/${oldFilename}`
          };
        }
      }

      try {
        const target = new URL(node.src, baseUrl);
        await assertPublicUrl(target);

        const response = await fetch(target, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
            "Referer": `${target.protocol}//${target.hostname}/`,
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
          }
        });

        if (!response.ok) return node;

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length < 50) return node; // ignore corrupt or dummy 0-byte files

        const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
        const ext = getExtension(response.headers.get("content-type"), target.pathname);
        const filename = `${hash}${ext}`;
        const filePath = resolve(targetDir, filename);

        if (!existsSync(filePath)) {
          writeFileSync(filePath, buffer);
        }

        return {
          ...node,
          src: documentId ? `/v1/assets/${documentId}/${filename}` : `/v1/assets/${filename}`
        };
      } catch {
        // If download fails, retain original remote src as fallback
        return node;
      }
    })
  );

  return {
    ...document,
    nodes: updatedNodes
  };
}

export function getAssetPath(relativePath: string, dataDir: string): string | null {
  if (!relativePath) return null;
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..")) return null;
  const assetsDir = resolve(dataDir, "assets");
  const filePath = resolve(assetsDir, normalized);
  if (!filePath.startsWith(assetsDir)) return null;
  return existsSync(filePath) && statSync(filePath).isFile() ? filePath : null;
}

export function getAssetStats(dataDir: string): { count: number; totalBytes: number } {
  const assetsDir = resolve(dataDir, "assets");
  if (!existsSync(assetsDir)) return { count: 0, totalBytes: 0 };
  let totalBytes = 0;
  let count = 0;

  function walk(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"].includes(ext)) {
          count += 1;
          totalBytes += statSync(fullPath).size;
        }
      }
    }
  }

  try {
    walk(assetsDir);
  } catch {
    // ignore concurrent removals
  }
  return { count, totalBytes };
}

export function clearAssetCache(dataDir: string): { deletedCount: number } {
  const assetsDir = resolve(dataDir, "assets");
  if (!existsSync(assetsDir)) return { deletedCount: 0 };
  let deletedCount = 0;

  function removeDir(dir: string, isRoot: boolean) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        removeDir(fullPath, false);
      } else if (entry.isFile()) {
        try {
          unlinkSync(fullPath);
          deletedCount += 1;
        } catch {}
      }
    }
    if (!isRoot) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {}
    }
  }

  try {
    removeDir(assetsDir, true);
  } catch {}
  return { deletedCount };
}

export function removeDocumentAssets(documentId: string, dataDir: string): void {
  const targetDir = resolve(dataDir, "assets", documentId);
  if (existsSync(targetDir)) {
    try {
      rmSync(targetDir, { recursive: true, force: true });
    } catch {}
  }
}

