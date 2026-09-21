import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { AppError } from "./errors.js";

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number);
    return a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224
      || a === 0;
  }
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return true;
  return normalized === "::1"
    || normalized === "::"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized);
}

export async function assertPublicUrl(url: URL): Promise<void> {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not allowed");
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new AppError("url_not_allowed", "Only standard HTTP(S) ports are allowed");
  }
  if (BLOCKED_HOSTNAMES.has(url.hostname.toLowerCase())) {
    throw new Error("Local network URLs are not allowed");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Private network addresses are not allowed");
  }
}

export async function safeFetchHtml(input: string, maxBytes: number): Promise<{
  url: string;
  html: string;
  contentType: string;
}> {
  let current = new URL(input);

  for (let redirect = 0; redirect <= 5; redirect += 1) {
    await assertPublicUrl(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "user-agent": "WebContentTranslator/0.1 (+content extraction)",
        accept: "text/html,application/xhtml+xml;q=0.9"
      }
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect response did not include a location");
      current = new URL(location, current);
      continue;
    }
    if (response.status === 401) throw new AppError("login_required", "This page requires login", 401);
    if (response.status === 429) throw new AppError("rate_limited", "The site is rate limiting requests", 429);
    if (!response.ok) throw new AppError("http_error", `Source returned HTTP ${response.status}`, response.status);

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error(`Unsupported content type: ${contentType || "unknown"}`);
    }

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > maxBytes) throw new Error("Source document is too large");

    if (!response.body) throw new AppError("http_error", "Source response had no body");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        length += result.value.byteLength;
        if (length > maxBytes) throw new AppError("source_too_large", "Source document is too large");
        chunks.push(result.value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      url: current.toString(),
      html: new TextDecoder().decode(bytes),
      contentType
    };
  }
  throw new Error("Too many redirects");
}
