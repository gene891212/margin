// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reactPath = new URL("../../../web/node_modules/react/index.js", import.meta.url).pathname;
const clientPath = new URL("../../../web/node_modules/react-dom/client.js", import.meta.url).pathname;
const hookPath = new URL("../../../web/src/hooks/useTranslationJob.ts", import.meta.url).pathname;
const { act, createElement } = await import(reactPath);
const { createRoot } = await import(clientPath);
const { useTranslationJob } = await import(hookPath);
const originalFetch = globalThis.fetch;
let root: ReturnType<typeof createRoot>;
let current: ReturnType<typeof useTranslationJob>;
const onJobsChanged = vi.fn().mockResolvedValue(undefined);

function Harness() {
  current = useTranslationJob(onJobsChanged);
  return null;
}

beforeEach(async () => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  document.body.innerHTML = '<div id="test-root"></div>';
  window.history.replaceState({}, "", "/");
  root = createRoot(document.getElementById("test-root")!);
  await act(async () => { root.render(createElement(Harness)); });
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
});

const request = {
  url: "https://example.com/article", targetLanguage: "zh-TW", browserMode: "desktop",
  useBrowserProfile: false, imageStorageMode: "local"
};
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

describe("job error recovery", () => {
  it("keeps polling after a temporary connection failure and clears the warning on recovery", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ jobId: "job-1" }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json({ status: "translating" }))
      .mockResolvedValueOnce(json({ status: "failed", errorCode: "translation_quota_exceeded", error: "Quota exceeded" }));
    globalThis.fetch = fetchMock;
    await act(async () => { await current.submit(request); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_200); });
    expect(current.status).toBe("queued");
    expect(current.errorCode).toBe("job_status_unavailable");
    await act(async () => { await vi.advanceTimersByTimeAsync(1_200); });
    expect(current.status).toBe("translating");
    expect(current.error).toBeUndefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_200); });
    expect(current.status).toBe("failed");
    expect(current.errorCode).toBe("translation_quota_exceeded");
    await act(async () => { await vi.advanceTimersByTimeAsync(2_400); });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("keeps submission error codes and does not retry an unrelated previous job", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(json({ jobId: "old-job" }))
      .mockResolvedValueOnce(json({ error: "reauth_required", message: "Complete login first" }, 409));
    await act(async () => { await current.submit(request); });
    expect(current.jobId).toBe("old-job");
    await act(async () => { await current.submit(request); });
    expect(current.status).toBe("failed");
    expect(current.jobId).toBeUndefined();
    expect(current.errorCode).toBe("reauth_required");
  });
});
