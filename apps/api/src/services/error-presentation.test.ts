import { afterEach, describe, expect, it, vi } from "vitest";
import { providerHttpError } from "./provider-errors.js";

// Exercise the browser-independent API client and presentation without a browser
// or a second test runner/dependency in the web package.
const apiModulePath = new URL("../../../web/src/lib/api.ts", import.meta.url).pathname;
const constantsModulePath = new URL("../../../web/src/constants.ts", import.meta.url).pathname;
const { api, ApiError, errorMessage, requestError } = await import(apiModulePath);
const { formatErrorDetail } = await import(constantsModulePath);
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("Chinese error explanations", () => {
  it.each([
    [530, '<html><body>Cloudflare Error code: 1033</body></html>', "Tunnel", "cloudflared", false],
    [530, '<html><body>Cloudflare Error code: 1016</body></html>', "來源主機", "DNS", false],
    [530, '<!doctype html><html>', "530", "無法確認", true],
    [401, '{"error":{"message":"Invalid API key"}}', "金鑰", "OPENAI_API_KEY", false],
    [429, '{"error":{"code":"insufficient_quota"}}', "額度", "餘額", false],
    [429, '{"error":{"code":"rate_limit_exceeded"}}', "頻率", "稍後", true],
    [500, '{"error":{"message":"token repeat limit reached"}}', "重複", "更換模型", true]
  ])("maps actual provider classifications to actionable Chinese", (status, raw, title, action, retryable) => {
    const error = providerHttpError(status, raw);
    const detail = formatErrorDetail(error.code, error.message);
    expect(detail.label).toContain(title);
    expect(`${detail.description ?? ""} ${detail.tip}`).toContain(action);
    expect(detail.retryable).toBe(retryable);
  });

  it("preserves API error codes for login guidance and explains them in other views", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "reauth_required", message: "Complete login first" }), { status: 409 }));
    let error: unknown;
    try { await api("/test"); } catch (reason) { error = reason; }
    expect(error).toBeInstanceOf(ApiError);
    expect(requestError(error, "fallback")).toEqual({ code: "reauth_required", message: "Complete login first" });
    expect(errorMessage(error, "fallback")).toContain("登入");
    expect(errorMessage(error, "fallback")).not.toContain("Complete login first");
  });

  it("distinguishes the local API being unreachable from the remote model service", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api("/test")).rejects.toMatchObject({ code: "api_unreachable" });
    expect(formatErrorDetail("api_unreachable").label).toContain("本機");
  });

  it.each(["not JSON", "null", "[]"]) ("handles malformed error bodies without losing HTTP status", async (body) => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(body, { status: 502 }));
    await expect(api("/test")).rejects.toMatchObject({ code: "api_http_error", status: 502 });
  });

  it("does not tell users to submit again while status polling reconnects", () => {
    const detail = formatErrorDetail("job_status_unavailable");
    expect(detail.retryable).toBe(false);
    expect(detail.description).toContain("仍在執行");
  });
});
