import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPublicUrl, safeFetchHtml } from "./safe-fetch.js";

afterEach(() => { vi.unstubAllGlobals(); });

describe("assertPublicUrl", () => {
  it("rejects local and private literal addresses", async () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "100.64.0.1", "169.254.1.1", "192.168.1.1", "[::1]", "[fe90::1]"]) {
      await expect(assertPublicUrl(new URL(`https://${address}/article`))).rejects.toThrow();
    }
  });

  it("rejects credentials and nonstandard ports", async () => {
    await expect(assertPublicUrl(new URL("https://user:pass@8.8.8.8/article"))).rejects.toThrow();
    await expect(assertPublicUrl(new URL("https://8.8.8.8:8080/article"))).rejects.toThrow();
  });

  it("allows a public HTTPS literal address", async () => {
    await expect(assertPublicUrl(new URL("https://8.8.8.8/article"))).resolves.toBeUndefined();
  });
});

describe("source error classification", () => {
  it("classifies a declared oversized page before reading its body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oversized article", {
      headers: { "content-type": "text/html", "content-length": "100" }
    })));
    await expect(safeFetchHtml("https://8.8.8.8/article", 5)).rejects.toMatchObject({ code: "source_too_large" });
  });

  it("explains unsupported content instead of reporting an unexpected error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("PDF", { headers: { "content-type": "application/pdf" } })));
    await expect(safeFetchHtml("https://8.8.8.8/article", 100)).rejects.toMatchObject({ code: "unsupported_content_type" });
  });

  it("keeps an article timeout distinct from a translation service timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")));
    await expect(safeFetchHtml("https://8.8.8.8/article", 100)).rejects.toMatchObject({ code: "source_timeout" });
  });
});
