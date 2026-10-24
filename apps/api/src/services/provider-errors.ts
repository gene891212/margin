import { JSDOM } from "jsdom";
import { AppError } from "./errors.js";

// Parse the complete response before shortening diagnostics for storage/display.
// Never retain an upstream HTML page, article output, or credential verbatim.
export function redactDiagnostic(value: string, secret?: string): string {
  let result = secret ? value.split(secret).join("[已隱藏金鑰]") : value;
  result = result.replace(/\bsk-[\w*.-]+/g, "[已隱藏金鑰]")
    .replace(/((?:incorrect|invalid) api key(?: provided)?\s*:\s*)[^\s"'<>]+/gi, "$1[已隱藏金鑰]")
    .replace(/\bBearer\s+[^\s"'<>]+/gi, "Bearer [已隱藏金鑰]")
    .replace(/((?:api[_-]?key|authorization|access[_-]?token)["']?\s*[:=]\s*["']?)[^\s"'<>,}]+/gi, "$1[已隱藏]")
    .replace(/https?:\/\/[^\s<>"']+/gi, (url) => {
      try {
        const parsed = new URL(url);
        parsed.username = "";
        parsed.password = "";
        parsed.search = "";
        parsed.hash = "";
        return parsed.toString();
      } catch { return "[網址]"; }
    });
  return result;
}

function responseReason(raw: string): { text: string; providerCode?: string; cloudflareCode?: string } {
  try {
    const data = JSON.parse(raw);
    const error = data?.error ?? data;
    if (typeof error === "string") return { text: error };
    if (error && typeof error === "object") {
      const text = [error.message, error.title, error.detail]
        .filter((value) => typeof value === "string" && value.trim()).join(" · ");
      const providerCode = [error.code, error.type, error.error_code]
        .filter((value) => typeof value === "string" || typeof value === "number").join(" / ") || undefined;
      const cloudflare = error.cloudflare_error === true || /cloudflare/i.test(`${text} ${providerCode ?? ""}`);
      return {
        text: text || "服務未提供錯誤說明",
        providerCode,
        cloudflareCode: cloudflare
          ? `${providerCode ?? ""} ${text}`.match(/\b(1016|1033)\b/)?.[1]
          : undefined
      };
    }
  } catch { /* Some gateways return an HTML error page or plain text. */ }

  if (/<(?:!doctype|html|head|body)\b/i.test(raw)) {
    const dom = new JSDOM(raw);
    const doc = dom.window.document;
    doc.querySelectorAll("script, style, noscript, footer, #cf-footer").forEach((element) => element.remove());
    const title = doc.title.trim();
    const headings = [...doc.querySelectorAll("h1, h2")].map((node) => node.textContent?.trim()).filter(Boolean).join(" · ");
    const body = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
    const visible = `${title} ${headings} ${body}`;
    const cloudflare = /cloudflare|cf-error|cf-wrapper/i.test(raw);
    const cloudflareCode = cloudflare
      ? visible.match(/(?:error(?:\s+code)?\s*[:#：]?\s*)(1\d{3})\b/i)?.[1]
      : undefined;
    const explanation = doc.querySelector(".cf-error-description")?.textContent?.replace(/\s+/g, " ").trim();
    dom.window.close();
    return {
      text: [title, headings !== title ? headings : undefined, explanation || body].filter(Boolean).join(" · "),
      cloudflareCode
    };
  }
  return {
    text: raw.replace(/\s+/g, " ").trim() || "服務未提供錯誤說明",
    cloudflareCode: raw.match(/\berror code\s*:\s*(1016|1033)\b/i)?.[1]
  };
}

export function providerHttpError(status: number, raw: string, endpoint?: string, secret?: string): AppError {
  const reason = responseReason(raw);
  const evidence = `${reason.providerCode ?? ""} ${reason.text}`;
  let code: string;
  if (status === 530 && reason.cloudflareCode === "1033") code = "translation_tunnel_unavailable";
  else if (status === 530 && reason.cloudflareCode === "1016") code = "translation_origin_dns_error";
  else if (status === 530) code = "translation_gateway_error";
  else if (/insufficient_quota|quota.{0,30}(?:exceeded|exhausted)|billing|credit balance|payment required/i.test(evidence) || status === 402) code = "translation_quota_exceeded";
  else if (status === 401 || /invalid_api_key|incorrect api key|invalid api key|authentication_error/i.test(evidence)) code = "translation_auth_failed";
  else if (/token repeat limit|repetition|repeated token/i.test(evidence)) code = "translation_generation_aborted";
  else if (/context_length_exceeded|maximum context length|context (?:window|length).{0,30}(?:exceed|limit)|too many tokens/i.test(evidence)) code = "translation_context_exceeded";
  else if (/model_not_found|model.{0,80}(?:not found|does not exist)/i.test(evidence)) code = "translation_model_not_found";
  else if (status === 429) code = "translation_rate_limited";
  else if (status === 403) code = "translation_forbidden";
  else if (status === 404) code = "translation_endpoint_not_found";
  else if (status === 499) code = "translation_request_cancelled";
  else if ([408, 504, 524].includes(status)) code = "translation_timeout";
  else if ([502, 503, 521, 522, 523].includes(status)) code = "translation_service_unavailable";
  else if (status >= 500) code = "translation_server_error";
  else if (status === 400 || status === 422) code = "translation_request_rejected";
  else code = "translation_provider_error";

  const host = endpoint ? new URL(endpoint).host : undefined;
  const message = [
    host ? `翻譯服務：${host}` : "翻譯服務",
    `HTTP ${status}`,
    reason.cloudflareCode ? `Cloudflare ${reason.cloudflareCode}` : undefined,
    reason.providerCode,
    redactDiagnostic(reason.text, secret).slice(0, 1_200)
  ].filter(Boolean).join("；");
  // The upstream status is diagnostic information, not the local API status.
  return new AppError(code, redactDiagnostic(message, secret).slice(0, 1_800), 502);
}

export function providerConnectionError(error: unknown, endpoint: string): AppError {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  function visit(value: unknown) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    const detail = value as { name?: string; code?: string; message?: string; cause?: unknown; errors?: unknown[] };
    parts.push(detail.name ?? "", detail.code ?? "", detail.message ?? "");
    visit(detail.cause);
    detail.errors?.forEach(visit);
  }
  visit(error);
  const evidence = parts.join(" ");
  const code = /TimeoutError|AbortError|ETIMEDOUT|UND_ERR_(?:CONNECT|HEADERS|BODY)_TIMEOUT/i.test(evidence) ? "translation_timeout"
    : /ENOTFOUND|EAI_AGAIN/i.test(evidence) ? "translation_dns_error"
    : /ECONNREFUSED/i.test(evidence) ? "translation_connection_refused"
    : /CERT_|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(evidence) ? "translation_tls_error"
    : "translation_network_error";
  return new AppError(code, `翻譯服務：${new URL(endpoint).host}；${redactDiagnostic(evidence).trim().slice(0, 1_200) || "連線失敗"}`, 502);
}

// Existing records only contain a shortened string. Reclassify what is provable;
// a truncated 530 must remain generic rather than inventing a DNS/tunnel cause.
export function storedJobError(errorCode: string | null, error: string | null) {
  if (error && (!errorCode || errorCode === "unexpected_error")) {
    const legacy = error.match(/^Translation provider returned HTTP (\d{3}):\s*([\s\S]*)$/);
    if (legacy) {
      const classified = providerHttpError(Number(legacy[1]), legacy[2] ?? "");
      return { errorCode: classified.code, error: classified.message };
    }
  }
  return { errorCode, error: error ? redactDiagnostic(error) : error };
}
