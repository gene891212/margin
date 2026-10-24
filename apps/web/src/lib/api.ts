import { formatErrorDetail } from "../constants";

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status?: number) {
    super(message);
  }
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { ...(options?.body ? { "content-type": "application/json" } : {}), ...options?.headers }
    });
  } catch {
    throw new ApiError("api_unreachable", "瀏覽器無法連線到本機 API。");
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const data = body && typeof body === "object" ? body as { message?: unknown; error?: unknown } : {};
    throw new ApiError(
      typeof data.error === "string" ? data.error : "api_http_error",
      typeof data.message === "string" ? data.message : `本機 API 回傳 HTTP ${response.status}`,
      response.status
    );
  }
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; }
  catch { throw new ApiError("invalid_api_response", "本機 API 沒有回傳有效的 JSON 資料。", response.status); }
}

export function requestError(reason: unknown, fallback: string) {
  return reason instanceof ApiError
    ? { code: reason.code, message: reason.message }
    : { code: "unexpected_error", message: reason instanceof Error ? reason.message : fallback };
}

export function errorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ApiError) {
    const detail = formatErrorDetail(reason.code, reason.message);
    return `${detail.label}。${detail.tip}`;
  }
  return reason instanceof Error ? reason.message : fallback;
}
