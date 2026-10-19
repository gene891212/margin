import { useMemo, useState } from "react";
import { Edit3, ExternalLink, Globe, RefreshCw, Tag, User } from "lucide-react";
import type { Article, DocumentNode, ReaderLayout } from "../../types";
import { getProxiedImageUrl } from "../../lib/image";
import { ArticleNode } from "./ArticleNode";
import { EditMetadataModal } from "./EditMetadataModal";
import { ImageLightbox, type LightboxImage } from "./ImageLightbox";

type ArticleReaderProps = {
  article: Article;
  showOriginal: boolean;
  layout?: ReaderLayout;
  recentTags?: string[];
  onNewTranslation: () => void;
  onRetry?: () => void;
  onUpdateMetadata?: (metadata: { category: string | null; tags: string[] }) => Promise<void>;
};

export function ArticleReader({
  article,
  showOriginal,
  layout = "stacked",
  recentTags = [],
  onNewTranslation,
  onRetry,
  onUpdateMetadata
}: ArticleReaderProps) {
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [showEditMetadata, setShowEditMetadata] = useState(false);

  const domain = useMemo(() => {
    try {
      return new URL(article.sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }, [article.sourceUrl]);

  const images: LightboxImage[] = useMemo(() => {
    return article.nodes
      .filter((node): node is DocumentNode & { src: string } => node.type === "image" && Boolean(node.src))
      .map((node) => ({
        id: node.id,
        src: node.src,
        alt: node.alt,
        proxiedSrc: getProxiedImageUrl(node.src)
      }));
  }, [article.nodes]);

  function handleOpenImage(nodeId: string) {
    const idx = images.findIndex((img) => img.id === nodeId);
    if (idx !== -1) {
      setActiveImageIndex(idx);
    }
  }

  const isSideBySide = layout === "side-by-side" && showOriginal;

  return (
    <article className={`${isSideBySide ? "max-w-6xl px-2 sm:px-4" : "max-w-3xl"} mx-auto py-6 transition-all duration-200`}>
      {/* Reading Header */}
      <header className="pb-8 mb-10 border-b border-[#ded8cb]">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-[#73786e] mb-4">
          <span className="px-2.5 py-0.5 rounded-full bg-[#ded8cb] font-semibold text-[#1a1d18] tracking-wide">
            {article.siteName ?? "原站文章"}
          </span>

          {/* Category Badge */}
          {article.category && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fbf2ef] text-[#c2411e] border border-[#f5d9cf] font-semibold tracking-wide shadow-2xs">
              <User className="w-3.5 h-3.5 text-[#c2411e]" />
              <span>{article.category}</span>
            </span>
          )}

          {/* Tags Badges */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {article.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#efece4] text-[#4a4e46] text-[11px] font-medium">
                  <Tag className="w-2.5 h-2.5 text-[#888c83]" />
                  <span>{tag}</span>
                </span>
              ))}
            </div>
          )}

          {/* Edit Metadata Button */}
          {onUpdateMetadata && (
            <button
              type="button"
              onClick={() => setShowEditMetadata(true)}
              className="inline-flex items-center gap-1 text-[11px] text-[#888c83] hover:text-[#1a1d18] px-2 py-0.5 rounded border border-[#ded8cb] hover:bg-[#efebe2] transition-colors cursor-pointer ml-auto"
            >
              <Edit3 className="w-3 h-3" />
              <span>編輯分類與標籤</span>
            </button>
          )}

          {domain && (
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noreferrer"
              title={`前往原網址：${article.sourceUrl}`}
              className="inline-flex items-center gap-1.5 text-[#73786e] hover:text-[#1a1d18] transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-[#888c83]" strokeWidth={1.5} />
              <span>網域：<span className="font-mono text-[#585c54]">{domain}</span></span>
            </a>
          )}
          {article.byline && <span>作者：{article.byline}</span>}
          {article.translationProvider === "mock" && (
            <span className="text-[11px] font-mono text-[#c2411e] bg-[#c2411e]/10 px-2 py-0.5 rounded">
              Mock 示範翻譯
            </span>
          )}
        </div>

        {isSideBySide && showOriginal && article.translatedTitle && article.title ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 items-baseline">
            <h1
              className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-[#111410] tracking-tight leading-[1.18]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {article.translatedTitle}
            </h1>
            <p
              className="text-xl sm:text-2xl text-[#64685f] font-normal leading-relaxed"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {article.title}
            </p>
          </div>
        ) : (
          <>
            <h1
              className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-[#111410] tracking-tight leading-[1.18]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {article.translatedTitle ?? article.title}
            </h1>

            {showOriginal && article.translatedTitle && article.title && (
              <p className="mt-3 text-sm sm:text-base text-[#6b7067] font-normal leading-relaxed" style={{ fontFamily: "var(--font-serif)" }}>
                {article.title}
              </p>
            )}
          </>
        )}

        <div className="mt-6 flex items-center justify-between text-xs text-[#73786e]">
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[#c2411e] hover:underline"
          >
            <span>原始發佈網址</span>
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
          </a>

          <span className="text-[11px] font-mono text-[#888c83]">
            {article.nodes.length} 個文稿段落節點
          </span>
        </div>
      </header>

      {/* Main Document Body */}
      <div className="editorial-reader">
        {article.nodes.map((node) => (
          <ArticleNode
            key={node.id}
            node={node}
            showOriginal={showOriginal}
            layout={layout}
            onOpenImage={handleOpenImage}
          />
        ))}
      </div>

      {/* Reader Bottom Navigation Bar */}
      <div className="mt-16 pt-8 border-t border-[#ded8cb] flex items-center justify-between text-xs text-[#73786e]">
        <button
          onClick={onNewTranslation}
          className="font-semibold text-[#c2411e] hover:text-[#d94f26] flex items-center gap-1.5 cursor-pointer"
        >
          <span>← 返回工作台翻譯新文章</span>
        </button>

        <div className="flex items-center gap-4">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="hover:text-[#c2411e] flex items-center gap-1.5 cursor-pointer transition-colors"
              title="重新翻譯這篇文章"
            >
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>重新翻譯此文章</span>
            </button>
          )}

          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="hover:text-[#1a1d18] transition-colors"
          >
            回到文章頂部 ↑
          </a>
        </div>
      </div>

      {/* Fancybox-style Image Lightbox */}
      {activeImageIndex !== null && (
        <ImageLightbox
          images={images}
          currentIndex={activeImageIndex}
          onClose={() => setActiveImageIndex(null)}
          onNavigate={(index) => setActiveImageIndex(index)}
        />
      )}

      {/* Edit Category & Tags Modal */}
      {showEditMetadata && onUpdateMetadata && (
        <EditMetadataModal
          initialCategory={article.category}
          initialTags={article.tags}
          recentTags={recentTags}
          onSave={onUpdateMetadata}
          onClose={() => setShowEditMetadata(false)}
        />
      )}
    </article>
  );
}
