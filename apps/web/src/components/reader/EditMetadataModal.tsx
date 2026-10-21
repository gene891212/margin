import { useEffect, useRef, useState } from "react";
import { Clock, Plus, Sparkles, Tag, User, X } from "lucide-react";

const SUGGESTED_ARTISTS = ["milet", "Aimer", "鈴木愛理"];
const SUGGESTED_TAGS = ["Fan Club", "訪談", "LIVE", "雜誌", "新曲", "日常日記"];

type EditMetadataModalProps = {
  initialCategory?: string | null;
  initialTags?: string[];
  recentTags?: string[];
  onSave: (metadata: { category: string | null; tags: string[] }) => Promise<void>;
  onClose: () => void;
};

export function EditMetadataModal({ initialCategory, initialTags = [], recentTags = [], onSave, onClose }: EditMetadataModalProps) {
  const [category, setCategory] = useState(initialCategory ?? "");
  const [tags, setTags] = useState<string[]>(initialTags);
  const [newTagInput, setNewTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const cleanRecentTags = recentTags
    .reduce<string[]>((acc, cur) => {
      const trimmed = cur.trim();
      if (trimmed && !acc.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
        acc.push(trimmed);
      }
      return acc;
    }, [])
    .slice(0, 8);

  const baseSuggestedTags = SUGGESTED_TAGS.filter(
    (st) => !cleanRecentTags.some((rt) => rt.toLowerCase() === st.toLowerCase())
  );

  function handleAddTag(tagToAdd: string) {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;
    if (!tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTags([...tags, trimmed]);
    }
    setNewTagInput("");
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags(tags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase()));
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await onSave({
        category: category.trim() || null,
        tags
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/45 backdrop-blur-xs"
    >
      <div
        className="w-full max-w-xl bg-[#faf8f5] rounded-2xl border border-[#ded8cb] shadow-2xl p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#ded8cb]">
          <h2
            className="text-lg font-bold text-[#1a1d18]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            編輯藝人分類與標籤
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#73786e] hover:text-[#1a1d18] hover:bg-[#efebe2] transition-colors cursor-pointer"
            title="關閉 (Esc)"
            aria-label="關閉 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 text-xs text-[#a42f20] bg-rose-50 border border-rose-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-5">
          {/* Category Section */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#4a4e46]">
              <User className="w-3.5 h-3.5 text-[#c2411e]" />
              <span>主分類（藝人 / 對象）</span>
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="例如：milet、Aimer、鈴木愛理"
              className="w-full px-3 py-2 text-sm bg-white rounded-lg border border-[#ded8cb] focus:border-[#c2411e] focus:outline-none placeholder-[#8a8e84] text-[#1a1d18]"
            />
            {/* Quick Pick Artists */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-[#8a8e84]">快速填入：</span>
              {SUGGESTED_ARTISTS.map((artist) => (
                <button
                  type="button"
                  key={artist}
                  onClick={() => setCategory(artist)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                    category === artist
                      ? "bg-[#c2411e] text-white border-[#c2411e]"
                      : "bg-[#efece4] text-[#4a4e46] border-transparent hover:border-[#ded8cb]"
                  }`}
                >
                  {artist}
                </button>
              ))}
              {category && (
                <button
                  type="button"
                  onClick={() => setCategory("")}
                  className="text-xs px-2 py-0.5 rounded-full text-[#8a8e84] hover:text-[#a42f20] cursor-pointer"
                >
                  清除
                </button>
              )}
            </div>
          </div>

          {/* Tags Section */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#4a4e46]">
              <Tag className="w-3.5 h-3.5 text-[#c2411e]" />
              <span>屬性標籤（Tags）</span>
            </label>

            {/* Unified Tag Input Box */}
            <div
              onClick={() => tagInputRef.current?.focus()}
              className="flex flex-wrap items-center gap-1.5 p-2 min-h-[46px] bg-white rounded-lg border border-[#ded8cb] focus-within:border-[#c2411e] focus-within:ring-2 focus-within:ring-[#c2411e]/10 transition-all cursor-text"
            >
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#efece4] text-xs font-medium text-[#1a1d18]"
                >
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTag(t);
                    }}
                    className="text-[#8a8e84] hover:text-[#a42f20] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              <div className="flex-1 min-w-[140px] flex items-center gap-1">
                <input
                  ref={tagInputRef}
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      handleAddTag(newTagInput);
                    } else if (e.key === "Backspace" && !newTagInput && tags.length > 0) {
                      const last = tags[tags.length - 1];
                      if (last) handleRemoveTag(last);
                    }
                  }}
                  placeholder={tags.length === 0 ? "輸入標籤後按 Enter（可多個）..." : "新增標籤..."}
                  className="w-full py-1 px-1 text-xs bg-transparent border-none focus:outline-none placeholder-[#8a8e84] text-[#1a1d18]"
                />
                {newTagInput.trim() && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddTag(newTagInput);
                    }}
                    className="px-2 py-0.5 text-xs font-medium bg-[#c2411e] hover:bg-[#ab3818] text-white rounded-md transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>新增</span>
                  </button>
                )}
              </div>
            </div>

            {/* Suggested & Recent Tags */}
            <div className="space-y-2 pt-1">
              {cleanRecentTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="flex items-center gap-1 text-[11px] text-[#8a8e84]">
                    <Clock className="w-3 h-3 text-[#8a8e84]" />
                    <span>近期使用：</span>
                  </span>
                  {cleanRecentTags.map((t) => {
                    const isSelected = tags.some((existing) => existing.toLowerCase() === t.toLowerCase());
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => {
                          if (isSelected) handleRemoveTag(t);
                          else handleAddTag(t);
                        }}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#c2411e] text-white border-[#c2411e]"
                            : "bg-[#efece4] text-[#4a4e46] border-transparent hover:border-[#ded8cb]"
                        }`}
                      >
                        {isSelected ? `✓ ${t}` : `+ ${t}`}
                      </button>
                    );
                  })}
                </div>
              )}

              {baseSuggestedTags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="flex items-center gap-1 text-[11px] text-[#8a8e84]">
                    <Sparkles className="w-3 h-3 text-[#8a8e84]" />
                    <span>常用推薦：</span>
                  </span>
                  {baseSuggestedTags.map((t) => {
                    const isSelected = tags.some((existing) => existing.toLowerCase() === t.toLowerCase());
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => {
                          if (isSelected) handleRemoveTag(t);
                          else handleAddTag(t);
                        }}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#c2411e] text-white border-[#c2411e]"
                            : "bg-[#efece4] text-[#4a4e46] border-transparent hover:border-[#ded8cb]"
                        }`}
                      >
                        {isSelected ? `✓ ${t}` : `+ ${t}`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded8cb]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-medium text-[#73786e] hover:text-[#1a1d18] hover:bg-[#efebe2] rounded-lg transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium bg-[#c2411e] hover:bg-[#ab3818] text-white rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? "儲存中..." : "儲存設定"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
