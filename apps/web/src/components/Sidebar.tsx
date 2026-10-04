import { useState } from "react";
import { MoreHorizontal, Plus, RefreshCw, Search, Settings, X } from "lucide-react";
import { ACTIVE_JOB_STATUSES } from "../constants";
import type { Article, BrowserProfile, ImageStorageMode, JobStatus, RecentJob } from "../types";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  onNewTranslation: () => void;
  jobs: RecentJob[];
  recentError?: string;
  onRefreshJobs: () => void;
  onOpenJob: (job: RecentJob) => void;
  activeJobId?: string;
  status: JobStatus;
  selectedJobId?: string;
  article?: Article;
  imageStorageMode: ImageStorageMode;
  profileStatus?: BrowserProfile["status"];
  onOpenSettings: () => void;
};

export function Sidebar({
  open,
  onClose,
  onNewTranslation,
  jobs,
  recentError,
  onRefreshJobs,
  onOpenJob,
  activeJobId,
  status,
  selectedJobId,
  article,
  imageStorageMode,
  profileStatus,
  onOpenSettings
}: SidebarProps) {
  const [searchFilter, setSearchFilter] = useState("");

  const filteredJobs = jobs.filter((j) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return (
      (j.translatedTitle && j.translatedTitle.toLowerCase().includes(query)) ||
      (j.title && j.title.toLowerCase().includes(query)) ||
      j.sourceUrl.toLowerCase().includes(query)
    );
  });

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 lg:w-72 flex flex-col border-r border-[#ded8cb] bg-[#faf8f5] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:static lg:translate-x-0 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Brand Masthead (Claude Style) */}
        <div className="px-4 py-3.5 flex items-center justify-between">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNewTranslation();
            }}
            className="flex items-baseline gap-1 group"
          >
            <span
              className="text-xl font-bold tracking-tight text-[#1a1d18]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Margin<span className="text-[#c2411e]">.</span>
            </span>
          </a>

          <div className="flex items-center gap-1">
            <button
              onClick={onNewTranslation}
              className="p-1.5 rounded-md text-[#73786e] hover:text-[#1a1d18] hover:bg-[#efebe2] transition-colors cursor-pointer"
              title="新文章翻譯 (⌘N)"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-md text-[#73786e] hover:text-[#1a1d18] hover:bg-[#efebe2]"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Primary Action Button (Claude "+ New" Row) */}
        <div className="px-3 pb-2">
          <button
            onClick={onNewTranslation}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-[#1a1d18] hover:bg-[#efebe2] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 font-medium">
              <Plus className="w-4 h-4 text-[#73786e]" strokeWidth={2} />
              <span>新文章翻譯</span>
            </div>
            <kbd className="text-[10px] font-mono text-[#8a8e84] px-1.5 py-0.5 rounded bg-[#eee8de]/70 border border-[#ded8cb]/60">
              ⌘N
            </kbd>
          </button>
        </div>

        {/* Search Bar for Past Jobs (Discreet) */}
        <div className="px-3 py-1">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-[#8a8e84]" strokeWidth={1.5} />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="搜尋歷史紀錄..."
              className="w-full pl-8 pr-6 py-1.5 text-xs bg-[#efece4]/70 hover:bg-[#efece4] focus:bg-white placeholder-[#8a8e84] text-[#1a1d18] rounded-md border border-transparent focus:border-[#ded8cb] focus:outline-none transition-colors"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter("")}
                className="absolute right-2 text-xs text-[#8a8e84] hover:text-[#1a1d18]"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Recent Jobs Feed (Scrollable, Flat Claude List Style) */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className="flex items-center justify-between px-2 pt-2 pb-1.5">
            <span className="text-xs text-[#8a8e84] font-medium">
              近期文章
            </span>
            <button
              onClick={onRefreshJobs}
              title="重新整理紀錄"
              className="text-[#8a8e84] hover:text-[#1a1d18] p-1 rounded transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>

          {recentError && (
            <div className="p-2 text-xs text-[#a42f20] bg-rose-50 border border-rose-200 rounded-md mb-2">
              {recentError}
            </div>
          )}

          {filteredJobs.length === 0 && !recentError ? (
            <div className="px-3 py-8 text-center text-xs text-[#8a8e84]">
              {searchFilter ? "找不到符合的文章" : "尚無文章紀錄"}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredJobs.map((job) => {
                const isActiveJob = job.id === activeJobId && ACTIVE_JOB_STATUSES.includes(status);
                const isSelected =
                  job.id === selectedJobId ||
                  (Boolean(article) && (
                    (job.documentId && job.documentId === new URLSearchParams(window.location.search).get("document")) ||
                    (job.sourceUrl && article?.sourceUrl && job.sourceUrl === article.sourceUrl)
                  ));

                const titleText = job.translatedTitle ?? job.title ?? job.sourceUrl;

                return (
                  <button
                    key={job.id}
                    onClick={() => onOpenJob(job)}
                    disabled={job.status === "failed"}
                    title={titleText}
                    className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-[13px] transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#e5e0d4] text-[#1a1d18] font-medium"
                        : "text-[#4a4e46] hover:bg-[#efebe2] hover:text-[#1a1d18]"
                    }`}
                  >
                    <span className="truncate flex-1 pr-2">
                      {titleText}
                    </span>

                    <span className="shrink-0 flex items-center gap-1.5 text-xs">
                      {isActiveJob ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#c2411e] animate-ping" />
                      ) : isSelected ? (
                        <MoreHorizontal className="w-3.5 h-3.5 text-[#73786e] opacity-70 group-hover:opacity-100" />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Footer: Settings Button (Claude Style) */}
        <div className="p-2 border-t border-[#ded8cb]/80 bg-[#faf8f5]">
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-[#efebe2] text-xs text-[#54584f] hover:text-[#1a1d18] transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-[#73786e] group-hover:rotate-45 transition-transform duration-300" strokeWidth={1.5} />
              <span className="font-medium">系統設定</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="bg-[#eee9df] text-[#54584f] px-1.5 py-0.5 rounded font-mono">
                {imageStorageMode === "local" ? "本地儲存" : "即時代理"}
              </span>
              {profileStatus === "ready" && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#3b6d36]" title="付費牆環境已就緒" />
              )}
            </div>
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/25 backdrop-blur-xs lg:hidden"
        />
      )}
    </>
  );
}
