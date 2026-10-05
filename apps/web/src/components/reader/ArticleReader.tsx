import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { Article, DocumentNode } from "../../types";
import { getProxiedImageUrl } from "../../lib/image";
import { ArticleNode } from "./ArticleNode";
import { ImageLightbox, type LightboxImage } from "./ImageLightbox";

type ArticleReaderProps = {
  article: Article;
  showOriginal: boolean;
  onNewTranslation: () => void;
};

export function ArticleReader({ article, showOriginal, onNewTranslation }: ArticleReaderProps) {
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

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
  return (
    <article className="max-w-3xl mx-auto py-6">
      {/* Reading Header */}
      <header className="pb-8 mb-10 border-b border-[#ded8cb]">
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#73786e] mb-4">
          <span className="px-2.5 py-0.5 rounded-full bg-[#ded8cb] font-semibold text-[#1a1d18] tracking-wide">
            {article.siteName ?? "原站文章"}
          </span>
          {article.byline && <span>作者：{article.byline}</span>}
          {article.translationProvider === "mock" && (
            <span className="text-[11px] font-mono text-[#c2411e] bg-[#c2411e]/10 px-2 py-0.5 rounded">
              Mock 示範翻譯
            </span>
          )}
        </div>

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

      {/* Fancybox-style Image Lightbox */}
      {activeImageIndex !== null && (
        <ImageLightbox
          images={images}
          currentIndex={activeImageIndex}
          onClose={() => setActiveImageIndex(null)}
          onNavigate={(index) => setActiveImageIndex(index)}
        />
      )}
    </article>
  );
}
