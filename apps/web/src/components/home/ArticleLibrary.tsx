import { useMemo, useState } from "react";
import { ArrowUpRight, AlertCircle, BookOpen, Clock, LayoutGrid, List, Search, Tag, User, X } from "lucide-react";
import type { RecentJob } from "../../types";

type ArticleLibraryProps = {
  jobs: RecentJob[];
  onOpenJob: (job: RecentJob) => void;
  onDeleteJob?: (jobId: string) => void;
};

const KNOWN_ARTISTS = ["milet", "Aimer", "鈴木愛理"];
const LIBRARY_VIEW_KEY = "wct_library_view";
type LibraryView = "cards" | "list";

export function ArticleLibrary({ jobs, onOpenJob }: ArticleLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<LibraryView>(() => {
    try {
      return window.localStorage.getItem(LIBRARY_VIEW_KEY) === "list" ? "list" : "cards";
    } catch {
      return "cards";
    }
  });

  function changeView(nextView: LibraryView) {
    setView(nextView);
    try {
      window.localStorage.setItem(LIBRARY_VIEW_KEY, nextView);
    } catch {
      // The view can still be changed when browser storage is unavailable.
    }
  }

  // Aggregate categories
  const categories = useMemo(() => {
    const custom = jobs
      .map((j) => j.category)
      .filter((c): c is string => Boolean(c) && !KNOWN_ARTISTS.some((a) => a.toLowerCase() === c!.toLowerCase()));
    return Array.from(new Set([...KNOWN_ARTISTS, ...custom]));
  }, [jobs]);

  // Jobs matching selected category
  const categoryJobs = useMemo(() => {
    if (!selectedCategory) return jobs;
    return jobs.filter((j) => j.category?.toLowerCase() === selectedCategory.toLowerCase());
  }, [jobs, selectedCategory]);

  // Tags available under selected category
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const job of categoryJobs) {
      if (job.tags) {
        for (const t of job.tags) {
          const trimmed = t.trim();
          if (trimmed) set.add(trimmed);
        }
      }
    }
    return Array.from(set);
  }, [categoryJobs]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return categoryJobs.filter((j) => {
      if (selectedTag && (!j.tags || !j.tags.some((t) => t.toLowerCase() === selectedTag.toLowerCase()))) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (j.translatedTitle && j.translatedTitle.toLowerCase().includes(q)) ||
          (j.title && j.title.toLowerCase().includes(q)) ||
          j.sourceUrl.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [categoryJobs, selectedTag, searchQuery]);

  function getDomain(url: string) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "網頁文章";
    }
  }

  function formatDate(iso: string) {
    try {
      const date = new Date(iso);
      return date.toLocaleDateString("zh-TW", {
        month: "short",
        day: "numeric"
      });
    } catch {
      return "";
    }
  }

  if (jobs.length === 0) {
    return null;
  }

  const hasFilter = selectedCategory !== null || selectedTag !== null || searchQuery.trim().length > 0;
  const articles = filteredJobs.filter((job) => job.status !== "failed");
  const failedJobs = filteredJobs.filter((job) => job.status === "failed");

  return (
    <section aria-label="文章文庫" className="space-y-6 pt-6 border-t border-[#ded8cb]">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#c2411e]" />
            <h2
              className="text-2xl font-bold text-[#1a1d18]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              文章文庫
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#ded8cb] font-semibold text-[#585c54]">
              {jobs.length} 筆
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#73786e] mt-1 font-serif">
            依分類、標籤或關鍵字，找到想繼續閱讀的文章。
          </p>
        </div>

        {/* Quick Search */}
        <div className="flex w-full sm:w-auto items-center gap-3">
          <div className="relative flex-1 min-w-0 sm:w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a8e84]" />
            <input
              type="text"
              aria-label="搜尋文章文庫"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋文庫標題或網址..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white rounded-lg border border-[#ded8cb] focus:border-[#c2411e] focus:outline-none placeholder-[#8a8e84] text-[#1a1d18] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="清除文庫搜尋"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8a8e84] hover:text-[#1a1d18]"
              >
                ×
              </button>
            )}
          </div>
          <div role="group" aria-label="文章檢視方式" className="flex shrink-0 items-center gap-0.5 rounded-lg bg-[#eee9de] p-1">
            {([
              { value: "cards", label: "卡片", Icon: LayoutGrid },
              { value: "list", label: "列表", Icon: List }
            ] as const).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-label={`${label}檢視`}
                aria-pressed={view === value}
                onClick={() => changeView(value)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2411e] ${view === value ? "bg-[#fffefb] text-[#1a1d18] shadow-xs" : "text-[#73786e] hover:text-[#1a1d18]"}`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Navigation Area */}
      <div className="space-y-3 py-1">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#4a4e46] shrink-0 mr-1">
            <User className="w-3.5 h-3.5 text-[#c2411e]" />
            <span>類別：</span>
          </span>

          <button
            type="button"
            aria-pressed={selectedCategory === null}
            onClick={() => {
              setSelectedCategory(null);
              setSelectedTag(null);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
              selectedCategory === null
                ? "bg-[#f3e5dd] text-[#a83b20] font-semibold"
                : "text-[#73786e] hover:bg-[#eee9de] hover:text-[#1a1d18]"
            }`}
          >
            全部 ({jobs.length})
          </button>

          {categories.map((cat) => {
            const count = jobs.filter((j) => j.category?.toLowerCase() === cat.toLowerCase()).length;
            const isSelected = selectedCategory?.toLowerCase() === cat.toLowerCase();
            return (
              <button
                type="button"
                aria-pressed={isSelected}
                key={cat}
                onClick={() => {
                  setSelectedCategory(isSelected ? null : cat);
                  setSelectedTag(null);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#f3e5dd] text-[#a83b20] font-semibold"
                    : "text-[#73786e] hover:bg-[#eee9de] hover:text-[#1a1d18]"
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? "text-[#a83b20]" : "text-[#8a8e84]"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null);
                setSelectedTag(null);
                setSearchQuery("");
              }}
              className="ml-auto text-xs text-[#c2411e] hover:underline cursor-pointer font-medium"
            >
              清除所有篩選
            </button>
          )}
        </div>

        {/* Tags Row */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#ded8cb]/60">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#4a4e46] shrink-0 mr-1">
              <Tag className="w-3.5 h-3.5 text-[#8a8e84]" />
              <span>標籤：</span>
            </span>

            {availableTags.map((tag) => {
              const isTagSelected = selectedTag?.toLowerCase() === tag.toLowerCase();
              return (
                <button
                  type="button"
                  aria-pressed={isTagSelected}
                  key={tag}
                  onClick={() => setSelectedTag(isTagSelected ? null : tag)}
                  className={`px-2.5 py-0.5 rounded-full text-xs transition-all cursor-pointer font-medium flex items-center gap-1 ${
                    isTagSelected
                      ? "bg-[#f3e5dd] text-[#a83b20] font-semibold"
                      : "text-[#73786e] hover:bg-[#eee9de] hover:text-[#1a1d18]"
                  }`}
                >
                  <span>#{tag}</span>
                  {isTagSelected && <X className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Articles Grid */}
      {filteredJobs.length === 0 ? (
        <div className="py-12 text-center bg-[#faf8f5] rounded-xl border border-dashed border-[#ded8cb]">
          <p className="text-sm text-[#73786e] font-serif">沒有符合所選類別、標籤或關鍵字的文章</p>
          {hasFilter && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null);
                setSelectedTag(null);
                setSearchQuery("");
              }}
              className="mt-3 px-3 py-1.5 text-xs text-[#c2411e] bg-white border border-[#ded8cb] rounded-lg hover:border-[#c2411e] transition-colors cursor-pointer"
            >
              重設篩選條件
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {articles.length > 0 && (
            <ul
              aria-label="文章"
              data-view={view}
              className={view === "cards" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "divide-y divide-[#ded8cb]/70 border-y border-[#ded8cb]/70"}
            >
              {articles.map((job) => {
                const domain = getDomain(job.sourceUrl);
                const dateStr = formatDate(job.createdAt);
                const displayTitle = job.translatedTitle || job.title || `${domain} 的文章`;
                const isComplete = job.status === "completed";
                const action = (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-[#73786e] group-hover:text-[#c2411e] transition-colors">
                    {isComplete ? "閱讀" : "查看進度"}
                    {isComplete ? <ArrowUpRight className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  </span>
                );

                return (
                  <li key={job.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenJob(job)}
                      title={displayTitle}
                      className={`group w-full h-full min-w-0 text-left cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2411e] ${
                        view === "cards"
                          ? "flex flex-col rounded-xl bg-[#fdfbf7] border border-[#ded8cb]/55 hover:border-[#b8b2a3] hover:bg-[#fffefb] p-5 sm:p-6"
                          : "flex items-start justify-between gap-4 py-5 px-2 -mx-2 rounded-lg hover:bg-[#eee9de]/50"
                      }`}
                    >
                      <div className="min-w-0 flex-1 w-full">
                        <div className="flex items-center justify-between gap-3 text-[11px] text-[#73786e]">
                          <span className="truncate">{domain}</span>
                          {view === "cards" && dateStr && (
                            <time dateTime={job.createdAt} className="shrink-0 text-[#8a8e84]">{dateStr}</time>
                          )}
                        </div>
                        <h3
                          className={`mt-2 font-semibold text-[#1a1d18] group-hover:text-[#a83b20] transition-colors line-clamp-2 leading-[1.6] ${view === "cards" ? "text-lg" : "text-base sm:text-lg"}`}
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {displayTitle}
                        </h3>
                        {job.translatedTitle && job.title && job.translatedTitle !== job.title && (
                          <p className="mt-1.5 text-xs leading-relaxed text-[#8a8e84] line-clamp-1 font-serif">{job.title}</p>
                        )}
                        {view === "list" && (job.category || Boolean(job.tags?.length)) && (
                          <div className="mt-2">
                            <ArticleLabels job={job} />
                          </div>
                        )}
                      </div>

                      {view === "list" && (
                        <div className="flex shrink-0 flex-col items-end gap-3 pt-0.5">
                          {dateStr && <time dateTime={job.createdAt} className="text-[11px] text-[#8a8e84]">{dateStr}</time>}
                          {action}
                        </div>
                      )}

                      {view === "cards" && (
                        <div className="flex items-center justify-between gap-3 mt-5 pt-1 w-full">
                          <ArticleLabels job={job} />
                          {action}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {failedJobs.length > 0 && (
            <section aria-label="未完成的翻譯" className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#73786e]">
                <h3 className="font-medium">未完成的翻譯</h3>
                <span>{failedJobs.length} 筆</span>
              </div>
              <ul className="divide-y divide-[#ded8cb]/60">
                {failedJobs.map((job) => {
                  const title = job.translatedTitle || job.title;
                  return (
                    <li key={job.id}>
                      <button
                        type="button"
                        onClick={() => onOpenJob(job)}
                        className="group flex w-full items-center gap-3 py-3 text-left rounded-md hover:bg-[#eee9de]/50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2411e]"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 text-[#b45a45]" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-[#585c54] truncate">{title || getDomain(job.sourceUrl)}</p>
                          <p className="mt-0.5 text-[11px] text-[#8a8e84] truncate" title={job.sourceUrl}>
                            {title ? getDomain(job.sourceUrl) : job.sourceUrl}
                          </p>
                        </div>
                        <time dateTime={job.createdAt} className="hidden sm:block text-[11px] text-[#8a8e84] shrink-0">{formatDate(job.createdAt)}</time>
                        <span className="flex items-center gap-1 text-xs text-[#a05b49] shrink-0 group-hover:text-[#c2411e]">
                          查看原因 <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </section>
  );
}


function ArticleLabels({ job }: { job: RecentJob }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-relaxed text-[#8a8e84]">
      {job.category && <span className="max-w-32 truncate font-medium text-[#6b7067]">{job.category}</span>}
      {job.tags?.slice(0, 2).map((tag) => (
        <span key={tag} title={`#${tag}`} className="max-w-28 truncate">#{tag}</span>
      ))}
      {job.tags && job.tags.length > 2 && <span>+{job.tags.length - 2}</span>}
    </div>
  );
}
