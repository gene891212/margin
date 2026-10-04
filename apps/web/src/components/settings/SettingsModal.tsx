import { useState, type ReactNode } from "react";
import { HardDrive, Search, Settings, ShieldCheck, Sparkles, X, type LucideIcon } from "lucide-react";
import type { BrowserProfile, ImageStorageMode, SettingsTab } from "../../types";

type NavItem = { tab: SettingsTab; label: string; icon: LucideIcon; keywords: string };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Settings",
    items: [
      { tab: "general", label: "General", icon: Settings, keywords: "general 一般 偏好 語言 渲染 雙語" },
      { tab: "storage", label: "Storage & Assets", icon: HardDrive, keywords: "storage 圖片 資產 儲存 下載 代理 proxy 快取 cache assets" },
      { tab: "browser", label: "Paywall & Browser", icon: ShieldCheck, keywords: "browser 付費牆 瀏覽器 登入 cookie profile chromium 帳號 會員" }
    ]
  },
  {
    label: "System",
    items: [{ tab: "engine", label: "AI Engine & Specs", icon: Sparkles, keywords: "engine ai 引擎 模型 openai gpt 規格 翻譯" }]
  }
];

const TAB_META: Record<SettingsTab, { title: string; subtitle: string }> = {
  general: { title: "General Preferences", subtitle: "全域目標語言、視窗模擬與雙語對照閱讀模式" },
  storage: { title: "Image Storage & Assets", subtitle: "文章圖片下載保存策略、伺服器離線快取管理" },
  browser: { title: "Paywall & Browser Environment", subtitle: "本機專屬 Chromium 付費會員登入與解鎖狀態管理" },
  engine: { title: "AI Engine & Architecture", subtitle: "AI 轉譯模型、上下文連貫度與本機資料庫規格" }
};

type SettingsModalProps = {
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onClose: () => void;
  /** Used for the small status badges in the nav. */
  imageStorageMode: ImageStorageMode;
  profileStatus?: BrowserProfile["status"];
  /** Content of the active tab. */
  children: ReactNode;
};

export function SettingsModal({ tab, onTabChange, onClose, imageStorageMode, profileStatus, children }: SettingsModalProps) {
  const [search, setSearch] = useState("");

  function trailingBadge(itemTab: SettingsTab) {
    if (itemTab === "storage") {
      return (
        <span className="text-[10px] font-mono text-[#73786e] shrink-0">
          {imageStorageMode === "local" ? "本地" : "代理"}
        </span>
      );
    }
    if (itemTab === "browser") {
      if (profileStatus === "ready") return <span className="w-1.5 h-1.5 rounded-full bg-[#3b6d36] shrink-0" title="已就緒" />;
      if (profileStatus === "reauth_required") return <span className="w-1.5 h-1.5 rounded-full bg-[#a42f20] shrink-0" title="需重新登入" />;
    }
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/45 backdrop-blur-xs">
      <div className="w-full max-w-4xl h-[620px] max-h-[90vh] bg-[#faf8f5] rounded-2xl border border-[#ded8cb] shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* LEFT SIDEBAR: Nav + Search (Claude Settings Style) */}
        <aside className="w-full md:w-60 lg:w-64 shrink-0 border-b md:border-b-0 md:border-r border-[#ded8cb] bg-[#f5f2ea]/80 p-3.5 flex flex-col">
          {/* Search Input */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#8a8e84]" strokeWidth={1.7} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#fbf9f4] hover:bg-white focus:bg-white text-[#1a1d18] placeholder-[#8a8e84] rounded-lg border border-[#ded8cb] focus:border-[#c2411e] focus:outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1.5 text-xs text-[#8a8e84] hover:text-[#1a1d18] p-0.5 cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {/* Navigation Categories */}
          <div className="space-y-4 flex-1 overflow-y-auto">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-2 pb-1.5 text-[11px] font-semibold text-[#8a8e84] tracking-wide">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items
                    .filter((item) => search === "" || item.keywords.includes(search.toLowerCase()))
                    .map((item) => {
                      const isActive = tab === item.tab;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.tab}
                          type="button"
                          onClick={() => onTabChange(item.tab)}
                          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                            isActive
                              ? "bg-[#fffefb] text-[#1a1d18] font-semibold border border-[#ded8cb] shadow-2xs"
                              : "text-[#54584f] hover:bg-[#eae5da]/70 hover:text-[#1a1d18] border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#c2411e]" : "text-[#73786e]"}`} strokeWidth={1.6} />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {trailingBadge(item.tab)}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* RIGHT CONTENT PANE: Settings Detail Cards */}
        <section className="flex-1 flex flex-col overflow-hidden bg-[#faf8f5]">
          {/* Header with Title and Close Button (Top right X) */}
          <div className="px-6 sm:px-8 py-4 border-b border-[#ded8cb]/70 flex items-center justify-between shrink-0 bg-[#faf8f5]">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#1a1d18]" style={{ fontFamily: "var(--font-serif)" }}>
                {TAB_META[tab].title}
              </h3>
              <p className="text-[11px] text-[#73786e] mt-0.5">{TAB_META[tab].subtitle}</p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#73786e] hover:text-[#1a1d18] hover:bg-[#ded8cb]/40 transition-colors cursor-pointer"
              title="關閉設定 (Esc)"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-5">{children}</div>
        </section>
      </div>
    </div>
  );
}
