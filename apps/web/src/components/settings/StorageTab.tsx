import type { ReactNode } from "react";
import { Check, RefreshCw, Trash2 } from "lucide-react";
import type { AssetStats, ImageStorageMode } from "../../types";
import { SettingLabel, SettingsCard } from "./SettingsCard";

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

type StorageTabProps = {
  imageStorageMode: ImageStorageMode;
  onImageStorageModeChange: (mode: ImageStorageMode) => void;
  assetStats: AssetStats | null;
  isLoadingStats: boolean;
  isClearingCache: boolean;
  onRefreshStats: () => void;
  onClearCache: () => void;
};

export function StorageTab({
  imageStorageMode,
  onImageStorageModeChange,
  assetStats,
  isLoadingStats,
  isClearingCache,
  onRefreshStats,
  onClearCache
}: StorageTabProps) {
  return (
    <>
      {/* Card 1: Storage Strategy Selection */}
      <SettingsCard className="space-y-4">
        <SettingLabel
          title="圖片儲存策略"
          description="決定文章辨識正文時圖片的保存與傳輸方式。切換後將自動應用於後續新任務。"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <StorageOptionCard
            selected={imageStorageMode === "local"}
            onSelect={() => onImageStorageModeChange("local")}
            title="本地下載儲存"
            badge="預設 / 推薦"
            badgeClassName="bg-[#3b6d36]/10 text-[#3b6d36] font-semibold"
            description={<>原圖自動下載並持久化儲存於伺服器目錄（<code className="text-[#8f2d13]">data/assets</code>）。</>}
            points={["避開防盜鏈（403）與跨來源 CORP 封鎖", "原網頁下線或改版仍可完整離線封存閱讀", "大幅加快二次開啟時的載入速度"]}
          />
          <StorageOptionCard
            selected={imageStorageMode === "proxy"}
            onSelect={() => onImageStorageModeChange("proxy")}
            title="即時線上代理"
            badge="節省硬碟"
            badgeClassName="bg-[#73786e]/10 text-[#54584f] font-mono"
            description="不儲存任何圖片檔案，閱讀時透過伺服器代理即時轉發。"
            points={["完全不佔用本機硬碟空間", "仍可解決瀏覽器 CORP 跨來源安全性封鎖", "若原站刪除圖片或加強驗證，未來可能失效"]}
          />
        </div>
      </SettingsCard>

      {/* Card 2: Cache & Directory Management */}
      <SettingsCard className="space-y-4">
        <div className="flex items-center justify-between">
          <SettingLabel title="本機圖片儲存庫狀態" description="已封存之靜態圖片資源統計" />
          <button
            type="button"
            onClick={onRefreshStats}
            disabled={isLoadingStats}
            className="text-[11px] text-[#73786e] hover:text-[#1a1d18] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingStats ? "animate-spin" : ""}`} strokeWidth={1.5} />
            <span>重新整理容量</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <StatTile label="已封存圖片數量">
            <div className="text-sm font-bold text-[#1a1d18] mt-0.5">
              {assetStats ? `${assetStats.count} 張` : "計算中..."}
            </div>
          </StatTile>
          <StatTile label="磁碟佔用空間">
            <div className="text-sm font-bold text-[#1a1d18] mt-0.5">
              {assetStats ? formatBytes(assetStats.totalBytes) : "計算中..."}
            </div>
          </StatTile>
          <StatTile label="本機目錄" className="col-span-2 sm:col-span-1">
            <div className="text-xs font-mono text-[#54584f] mt-0.5 truncate">
              data/assets
            </div>
          </StatTile>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="text-[11px] text-[#73786e]">
            清空快取不會影響文章文字內容；若清空，文章圖片在瀏覽時將透過線上代理嘗試載入。
          </span>
          <button
            type="button"
            onClick={onClearCache}
            disabled={isClearingCache || !assetStats || assetStats.count === 0}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 bg-rose-50/60 hover:bg-rose-100 disabled:opacity-40 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isClearingCache ? "清除中..." : "清空圖片快取"}</span>
          </button>
        </div>
      </SettingsCard>
    </>
  );
}

type StorageOptionCardProps = {
  selected: boolean;
  onSelect: () => void;
  title: string;
  badge: string;
  badgeClassName: string;
  description: ReactNode;
  points: string[];
};

function StorageOptionCard({ selected, onSelect, title, badge, badgeClassName, description, points }: StorageOptionCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
        selected
          ? "border-[#c2411e] bg-[#fbf8f2] shadow-xs"
          : "border-[#ded8cb] bg-[#faf8f5] hover:border-[#cbcaa0]"
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#1a1d18]">{title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${badgeClassName}`}>
              {badge}
            </span>
          </div>
          {selected && <Check className="w-4 h-4 text-[#c2411e]" strokeWidth={2.5} />}
        </div>
        <p className="text-[11px] text-[#585c54] leading-relaxed">{description}</p>
        <ul className="text-[10px] text-[#73786e] space-y-1 pt-1 list-disc pl-3.5">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatTile({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`bg-[#faf8f5] p-3 rounded-lg border border-[#ded8cb]/60 ${className}`}>
      <div className="text-[10px] text-[#73786e]">{label}</div>
      {children}
    </div>
  );
}
