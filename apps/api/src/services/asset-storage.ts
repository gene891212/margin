import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
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

export function ensureAssetsDir(dataDir: string): string {
  const assetsDir = resolve(dataDir, "assets");
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }
  return assetsDir;
}

export async function downloadAndLocalizeImages(input: {
  document: DocumentAst;
  baseUrl: string;
  dataDir: string;
}): Promise<DocumentAst> {
  const { document, baseUrl, dataDir } = input;
  const assetsDir = ensureAssetsDir(dataDir);

  const updatedNodes = await Promise.all(
    document.nodes.map(async (node) => {
      if (node.type !== "image" || !node.src) return node;
      if (node.src.startsWith("/v1/assets/") || node.src.startsWith("data:")) return node;

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
        const filePath = resolve(assetsDir, filename);

        if (!existsSync(filePath)) {
          writeFileSync(filePath, buffer);
        }

        return {
          ...node,
          src: `/v1/assets/${filename}`
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

export function getAssetPath(filename: string, dataDir: string): string | null {
  const safeName = basename(filename);
  if (safeName !== filename) return null;
  const filePath = resolve(dataDir, "assets", safeName);
  return existsSync(filePath) ? filePath : null;
}

export function getAssetStats(dataDir: string): { count: number; totalBytes: number } {
  const assetsDir = resolve(dataDir, "assets");
  if (!existsSync(assetsDir)) return { count: 0, totalBytes: 0 };
  const files = readdirSync(assetsDir);
  let totalBytes = 0;
  let count = 0;
  for (const file of files) {
    try {
      const stats = statSync(resolve(assetsDir, file));
      if (stats.isFile()) {
        count += 1;
        totalBytes += stats.size;
      }
    } catch {
      // ignore concurrent removals
    }
  }
  return { count, totalBytes };
}

export function clearAssetCache(dataDir: string): { deletedCount: number } {
  const assetsDir = resolve(dataDir, "assets");
  if (!existsSync(assetsDir)) return { deletedCount: 0 };
  const files = readdirSync(assetsDir);
  let deletedCount = 0;
  for (const file of files) {
    try {
      unlinkSync(resolve(assetsDir, file));
      deletedCount += 1;
    } catch {
      // ignore
    }
  }
  return { deletedCount };
}
