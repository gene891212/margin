import { useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Clock, Globe, Search, Tag, Trash2, User, X } from "lucide-react";
import type { RecentJob } from "../../types";

type ArticleLibraryProps = {
  jobs: RecentJob[];
  onOpenJob: (job: RecentJob) => void;
  onDeleteJob?: (jobId: string) => void;
};

const KNOWN_ARTISTS = ["milet", "Aimer", "鈴木愛理"];

export function ArticleLibrary({ jobs, onOpenJob, onDeleteJob }: ArticleLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <section className="space-y-6 pt-6 border-t border-[#ded8cb]">
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
              {jobs.length} 篇
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#73786e] mt-1 font-serif">
            瀏覽已收錄的翻譯文章，可依藝人對象與標籤進行分類研讀。
          </p>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a8e84]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋文庫標題或網址..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-white rounded-lg border border-[#ded8cb] focus:border-[#c2411e] focus:outline-none placeholder-[#8a8e84] text-[#1a1d18] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8a8e84] hover:text-[#1a1d18]"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Filter Navigation Area */}
      <div className="space-y-3 bg-[#f6f3ee] p-4 rounded-xl border border-[#ded8cb]">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#4a4e46] shrink-0 mr-1">
            <User className="w-3.5 h-3.5 text-[#c2411e]" />
            <span>類別：</span>
          </span>

          <button
            type="button"
            onClick={() => {
              setSelectedCategory(null);
              setSelectedTag(null);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
              selectedCategory === null
                ? "bg-[#c2411e] text-white shadow-2xs font-semibold"
                : "bg-white text-[#585c54] border border-[#ded8cb] hover:border-[#c2411e]/40 hover:text-[#1a1d18]"
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
                key={cat}
                onClick={() => {
                  setSelectedCategory(isSelected ? null : cat);
                  setSelectedTag(null);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#c2411e] text-white shadow-2xs font-semibold"
                    : "bg-white text-[#585c54] border border-[#ded8cb] hover:border-[#c2411e]/40 hover:text-[#1a1d18]"
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? "bg-white/20 text-white" : "bg-[#efece4] text-[#8a8e84]"
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
                  key={tag}
                  onClick={() => setSelectedTag(isTagSelected ? null : tag)}
                  className={`px-2.5 py-0.5 rounded-full text-xs transition-all cursor-pointer font-medium flex items-center gap-1 ${
                    isTagSelected
                      ? "bg-[#c2411e] text-white shadow-2xs font-semibold"
                      : "bg-white text-[#585c54] border border-[#ded8cb] hover:border-[#c2411e]/40 hover:text-[#1a1d18]"
                  }`}
                >
                  <span>#{tag}</span>
                  {isTagSelected && <X className="w-3 h-3 text-white/80" />}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            const domain = getDomain(job.sourceUrl);
            const dateStr = formatDate(job.createdAt);
            const displayTitle = job.translatedTitle || job.title || job.sourceUrl;
            const isFailed = job.status === "failed";

            return (
              <div
                key={job.id}
                onClick={() => onOpenJob(job)}
                className="bg-[#faf8f5] hover:bg-white border border-[#ded8cb] hover:border-[#c2411e]/40 rounded-xl p-4.5 transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer flex flex-col justify-between group text-left relative"
              >
                <div>
                  {/* Top Meta Row */}
                  <div className="flex items-center justify-between text-[11px] text-[#73786e] mb-2.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-[#efece4] font-medium text-[#585c54] truncate max-w-[120px]">
                        {domain}
                      </span>
                      {job.category && (
                        <span className="px-2 py-0.5 rounded-full font-medium bg-[#fbf2ef] text-[#c2411e] border border-[#c2411e]/20 truncate">
                          {job.category}
                        </span>
                      )}
                    </div>
                    {dateStr && <span className="text-[#8a8e84] shrink-0 font-mono text-[10px]">{dateStr}</span>}
                  </div>

                  {/* Title */}
                  <h3
                    className="text-base font-bold text-[#1a1d18] group-hover:text-[#c2411e] transition-colors line-clamp-2 leading-snug mb-1"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {displayTitle}
                  </h3>

                  {/* Subtitle / Original Title */}
                  {job.translatedTitle && job.title && job.translatedTitle !== job.title && (
                    <p className="text-xs text-[#8a8e84] line-clamp-1 font-serif mb-3">
                      {job.title}
                    </p>
                  )}
                </div>

                {/* Bottom Row: Tags & Action */}
                <div className="pt-3 mt-3 border-t border-[#ded8cb]/60 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1 min-w-0">
                    {job.tags && job.tags.length > 0 ? (
                      job.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-[#efece4] text-[#6b7067] font-medium truncate max-w-[90px]"
                        >
                          #{t}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-[#8a8e84] italic">無標籤</span>
                    )}
                    {job.tags && job.tags.length > 3 && (
                      <span className="text-[10px] text-[#8a8e84]">+{job.tags.length - 3}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isFailed ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-[#b93815] border border-rose-200 font-medium">
                        解析失敗
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-[#73786e] group-hover:text-[#c2411e] flex items-center gap-0.5 transition-colors">
                        閱讀
                        <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
