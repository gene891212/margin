import { useEffect, useRef, useState } from "react";
import { MoreVertical, PanelLeftClose, Plus, RefreshCw, Search, Settings, Trash2 } from "lucide-react";
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
  onDeleteJob?: (jobId: string) => void;
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
  onDeleteJob,
  activeJobId,
  status,
  selectedJobId,
  article,
  imageStorageMode,
  profileStatus,
  onOpenSettings
}: SidebarProps) {
  const [searchFilter, setSearchFilter] = useState("");
  const [openMenuJobId, setOpenMenuJobId] = useState<string | null>(null);
  const [menuPlacement, setMenuPlacement] = useState<"top" | "bottom">("bottom");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuJobId) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuJobId(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuJobId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuJobId]);

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
        className={`fixed inset-y-0 left-0 z-40 w-64 lg:w-72 shrink-0 flex flex-col border-r border-[#ded8cb] bg-[#faf8f5] transition-[margin,transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:static ${
          open
            ? "translate-x-0 shadow-2xl lg:shadow-none lg:ml-0"
            : "-translate-x-full lg:-ml-72 lg:pointer-events-none"
        }`}
      >
        {/* Brand Masthead (Claude Style) */}
        <div className="h-14 px-4 flex items-center justify-between shrink-0">
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

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#73786e] hover:text-[#1a1d18] hover:bg-[#efebe2] transition-colors cursor-pointer"
            title="收起側邊欄"
          >
            <PanelLeftClose className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Primary Action Button (Claude "+ New" Row) */}
        <div className="px-3 pb-2">
          <button
            onClick={onNewTranslation}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[#1a1d18] hover:bg-[#efebe2] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#73786e]" strokeWidth={2} />
            <span>新文章翻譯</span>
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

                const isMenuOpen = openMenuJobId === job.id;

                return (
                  <div
                    key={job.id}
                    className={`group relative flex items-center justify-between rounded-lg text-left text-[13px] transition-colors ${
                      isSelected
                        ? "bg-[#e5e0d4] text-[#1a1d18] font-medium"
                        : "text-[#4a4e46] hover:bg-[#efebe2] hover:text-[#1a1d18]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenJob(job)}
                      disabled={job.status === "failed"}
                      title={titleText}
                      className="flex-1 min-w-0 py-1.5 pl-2.5 pr-1 text-left truncate cursor-pointer disabled:cursor-not-allowed"
                    >
                      <span className="truncate block">{titleText}</span>
                    </button>

                    <div className="shrink-0 flex items-center pr-1.5">
                      {isActiveJob && !isMenuOpen ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#c2411e] animate-ping mr-1" />
                      ) : null}

                      <div className="relative" ref={isMenuOpen ? menuRef : undefined}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isMenuOpen) {
                              setOpenMenuJobId(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPlacement(window.innerHeight - rect.bottom < 80 ? "top" : "bottom");
                              setOpenMenuJobId(job.id);
                            }
                          }}
                          title="更多選項"
                          className={`p-1 rounded-md text-[#73786e] hover:text-[#1a1d18] hover:bg-[#d8d2c4] transition-all cursor-pointer ${
                            isMenuOpen
                              ? "opacity-100 bg-[#d8d2c4] text-[#1a1d18]"
                              : "opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          <MoreVertical className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>

                        {isMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute right-0 w-32 bg-white rounded-xl shadow-lg border border-[#ded8cb] p-1 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                              menuPlacement === "top" ? "bottom-full mb-1" : "top-full mt-1"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuJobId(null);
                                const title = job.translatedTitle || job.title || "此文章";
                                if (window.confirm(`確定要刪除「${title}」的紀錄嗎？`)) {
                                  onDeleteJob?.(job.id);
                                }
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] text-[#c2411e] hover:bg-[#fbf2ef] transition-colors cursor-pointer text-left"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#c2411e]" strokeWidth={1.75} />
                              <span>刪除</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
