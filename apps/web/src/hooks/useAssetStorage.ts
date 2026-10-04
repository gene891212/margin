import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { IMAGE_STORAGE_MODE_KEY } from "../constants";
import type { AssetStats, ImageStorageMode } from "../types";

export function useAssetStorage() {
  const [imageStorageMode, setImageStorageModeState] = useState<ImageStorageMode>(() => {
    const saved = localStorage.getItem(IMAGE_STORAGE_MODE_KEY);
    return saved === "proxy" ? "proxy" : "local";
  });
  const [assetStats, setAssetStats] = useState<AssetStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  function setImageStorageMode(mode: ImageStorageMode) {
    setImageStorageModeState(mode);
    localStorage.setItem(IMAGE_STORAGE_MODE_KEY, mode);
  }

  const refreshAssetStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const stats = await api<AssetStats>("/v1/assets/stats");
      setAssetStats(stats);
    } catch {
      // ignore
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  async function clearAssetCache() {
    if (!window.confirm("確定清空所有已下載至本地的圖片資產快取嗎？\n（已翻譯文章的圖片在重新瀏覽時將透過線上代理動態載入）")) return;
    setIsClearingCache(true);
    try {
      await api("/v1/assets", { method: "DELETE" });
      await refreshAssetStats();
    } catch (e) {
      alert("清空快取失敗：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsClearingCache(false);
    }
  }

  useEffect(() => {
    void refreshAssetStats().catch(() => undefined);
  }, [refreshAssetStats]);

  return {
    imageStorageMode,
    setImageStorageMode,
    assetStats,
    isLoadingStats,
    isClearingCache,
    refreshAssetStats,
    clearAssetCache
  };
}
