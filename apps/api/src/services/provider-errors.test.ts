import { describe, expect, it } from "vitest";
import { providerConnectionError, providerHttpError, storedJobError } from "./provider-errors.js";
import { describeError } from "./errors.js";

describe("translation provider diagnostics", () => {
  it.each([
    [401, { error: { message: "Invalid API key" } }, "translation_auth_failed"],
    [429, { error: { code: "insufficient_quota", message: "Quota exceeded" } }, "translation_quota_exceeded"],
    [429, { error: { code: "rate_limit_exceeded", message: "Rate limited" } }, "translation_rate_limited"],
    [500, { error: { message: "prediction aborted, token repeat limit reached" } }, "translation_generation_aborted"],
    [400, { error: { code: "context_length_exceeded", message: "Too long" } }, "translation_context_exceeded"],
    [404, { error: "model 'test' not found" }, "translation_model_not_found"],
    [404, { error: { message: "Unknown route" } }, "translation_endpoint_not_found"],
    [403, { error: { message: "Forbidden" } }, "translation_forbidden"],
    [503, { error: { message: "Unavailable" } }, "translation_service_unavailable"],
    [504, { error: { message: "Timeout" } }, "translation_timeout"],
    [499, {}, "translation_request_cancelled"]
  ])("classifies HTTP %s using the service error body", (status, body, code) => {
    const error = providerHttpError(status, JSON.stringify(body), "https://models.example/v1/chat/completions");
    expect(describeError(error).code).toBe(code);
    expect(error.message).toContain(`HTTP ${status}`);
    expect(error.message).toContain("models.example");
    expect(error.httpStatus).toBe(502);
  });

  it.each([["1033", "translation_tunnel_unavailable"], ["1016", "translation_origin_dns_error"]])(
    "finds Cloudflare %s after a long HTML header",
    (cfCode, code) => {
      const html = `<!doctype html><html><head><!--${"padding".repeat(1_000)}--></head><body><div id="cf-wrapper"><h1>Error ${cfCode}</h1><h2>Cloudflare error</h2><p>Origin unavailable</p></div><script>secretScript()</script></body></html>`;
      const error = providerHttpError(530, html);
      expect(error.code).toBe(code);
      expect(error.message).toContain(`Cloudflare ${cfCode}`);
      expect(error.message).toContain("Origin unavailable");
      expect(error.message).not.toContain("<html>");
      expect(error.message).not.toContain("secretScript");
    }
  );

  it("recognizes a plain Cloudflare error code without HTML", () => {
    expect(providerHttpError(530, "error code: 1033").code).toBe("translation_tunnel_unavailable");
  });

  it("reads structured gateway problem responses as well as HTML", () => {
    const error = providerHttpError(530, JSON.stringify({
      title: "Error 1033: Cloudflare Tunnel error", detail: "No healthy connector", error_code: 1033,
      cloudflare_error: true
    }));
    expect(error.code).toBe("translation_tunnel_unavailable");
    expect(error.message).toContain("No healthy connector");
  });

  it("does not invent a cause from an old truncated 530", () => {
    const result = storedJobError("unexpected_error", 'Translation provider returned HTTP 530: <!doctype html><html class="no-js">');
    expect(result.errorCode).toBe("translation_gateway_error");
    expect(result.error).not.toMatch(/1016|1033|<html/);
  });

  it("reclassifies old key and generation errors without changing stored records", () => {
    expect(storedJobError("unexpected_error", 'Translation provider returned HTTP 401: {"error":{"message":"Incorrect API key provided: sk-test-secret').errorCode).toBe("translation_auth_failed");
    expect(storedJobError("unexpected_error", 'Translation provider returned HTTP 500: {"error":{"message":"prediction aborted, token repeat limit reached"}}').errorCode).toBe("translation_generation_aborted");
    expect(storedJobError(null, null)).toEqual({ errorCode: null, error: null });
  });

  it("redacts custom credentials and URL credentials before retaining diagnostics", () => {
    const error = providerHttpError(401, JSON.stringify({ error: { message: "Key custom-secret rejected at https://user:password@models.example/api?api_key=other-secret" } }), "https://models.example/v1", "custom-secret");
    expect(error.message).not.toMatch(/custom-secret|password|other-secret|user:/);
    expect(error.message).toContain("models.example");
  });

  it.each([
    [Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } }), "translation_connection_refused"],
    [Object.assign(new Error("fetch failed"), { cause: { code: "ENOTFOUND" } }), "translation_dns_error"],
    [new DOMException("Timed out", "TimeoutError"), "translation_timeout"],
    [Object.assign(new Error("fetch failed"), { cause: { code: "CERT_HAS_EXPIRED" } }), "translation_tls_error"],
    [new AggregateError([{ code: "ECONNREFUSED" }], "fetch failed"), "translation_connection_refused"],
    [new Error("socket closed"), "translation_network_error"]
  ])("classifies nested connection causes", (error, code) => {
    expect(providerConnectionError(error, "https://models.example/v1").code).toBe(code);
  });
});
