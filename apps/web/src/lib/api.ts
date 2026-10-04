export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options?.body ? { "content-type": "application/json" } : {}), ...options?.headers }
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message ?? body.error ?? `HTTP ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

export function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}
