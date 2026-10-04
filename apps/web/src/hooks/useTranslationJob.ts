import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import type { Article, BrowserMode, ImageStorageMode, JobStatus, RecentJob } from "../types";

export type TranslationRequest = {
  url: string;
  targetLanguage: string;
  browserMode: BrowserMode;
  useBrowserProfile: boolean;
  imageStorageMode: ImageStorageMode;
};

const POLL_INTERVAL_MS = 1200;

/**
 * Owns the current translation job lifecycle: submitting, polling status,
 * and loading the resulting document.
 *
 * @param onJobsChanged called whenever the server-side job list likely changed.
 *   Should be a stable function (e.g. from useCallback).
 */
export function useTranslationJob(onJobsChanged: () => Promise<void>) {
  const [status, setStatus] = useState<JobStatus>("idle");
  const [jobId, setJobId] = useState<string>();
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const [article, setArticle] = useState<Article>();
  const [error, setError] = useState<string>();

  const loadDocument = useCallback(async (id: string, isActive: () => boolean = () => true) => {
    const result = await api<{ document: Article }>(`/v1/documents/${id}`);
    if (!isActive()) return;
    setArticle(result.document);
    setStatus("completed");
    window.history.replaceState({}, "", `?document=${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Restore the document referenced in the URL on first load.
  useEffect(() => {
    const selectedDocument = new URLSearchParams(window.location.search).get("document");
    if (!selectedDocument) return;
    void loadDocument(selectedDocument).catch(() => undefined);
  }, [loadDocument]);

  // Poll the active job until it reaches a terminal state.
  useEffect(() => {
    if (!jobId || ["completed", "failed"].includes(status)) return;
    let active = true;
    let inFlight = false;
    const timer = window.setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const job = await api<{ status: JobStatus; error?: string; documentId?: string }>(`/v1/translation-jobs/${jobId}`);
        if (!active) return;
        if (job.status === "completed") {
          await onJobsChanged().catch(() => undefined);
          if (!active) return;
          setStatus("completed");
          if (job.documentId) {
            await loadDocument(job.documentId);
          }
        } else if (job.status === "failed") {
          setStatus("failed");
          setError(job.error ?? "無法處理這個頁面");
          void onJobsChanged().catch(() => undefined);
        } else {
          setStatus(job.status);
        }
      } catch (reason) {
        if (!active) return;
        setStatus("failed");
        setError(errorMessage(reason, "無法取得工作狀態"));
      } finally {
        inFlight = false;
      }
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [jobId, status, onJobsChanged, loadDocument]);

  async function submit(request: TranslationRequest) {
    setError(undefined);
    setArticle(undefined);
    setStatus("queued");
    try {
      const job = await api<{ jobId: string }>("/v1/translation-jobs", {
        method: "POST",
        body: JSON.stringify({
          source: { type: "url", url: request.url },
          targetLanguage: request.targetLanguage,
          browserMode: request.browserMode,
          useBrowserProfile: request.useBrowserProfile,
          imageStorageMode: request.imageStorageMode
        })
      });
      setJobId(job.jobId);
      setSelectedJobId(job.jobId);
      void onJobsChanged().catch(() => undefined);
    } catch (reason) {
      setStatus("failed");
      setError(errorMessage(reason, "無法建立工作"));
    }
  }

  /**
   * Opens a job from history. Resolves to `true` when the view switched to the job
   * (so callers can e.g. close the mobile sidebar). Rejects if its document fails to load.
   */
  async function openJob(job: RecentJob): Promise<boolean> {
    setError(undefined);
    setSelectedJobId(job.id);
    if (job.documentId) {
      await loadDocument(job.documentId);
      return true;
    }
    if (job.status !== "failed") {
      setJobId(job.id);
      setStatus(job.status);
      setArticle(undefined);
      return true;
    }
    return false;
  }

  /** Clears the current job/article and returns to the input console. */
  function reset() {
    setArticle(undefined);
    setJobId(undefined);
    setSelectedJobId(undefined);
    setStatus("idle");
    setError(undefined);
    window.history.replaceState({}, "", window.location.pathname);
  }

  return { status, jobId, selectedJobId, article, error, submit, openJob, reset };
}
