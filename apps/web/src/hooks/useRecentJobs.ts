import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { RecentJob } from "../types";

export function useRecentJobs() {
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [recentError, setRecentError] = useState<string>();

  // Only touches state setters, so it is stable across renders.
  const refreshJobs = useCallback(async () => {
    const result = await api<{ jobs: RecentJob[] }>("/v1/translation-jobs");
    setRecentJobs(result.jobs);
    setRecentError(undefined);
  }, []);

  useEffect(() => {
    void refreshJobs().catch(() => setRecentError("目前無法載入文章紀錄"));
  }, [refreshJobs]);

  return { recentJobs, recentError, setRecentError, refreshJobs };
}
