import type { DocumentNode, InlineContainer, InlineNode, ReaderLayout } from "../../types";
import { getProxiedImageUrl } from "../../lib/image";

function InlineView({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === "text") return <span key={index}>{node.text}</span>;
        if (node.type === "break") return <br key={index} />;
        const content = <InlineView nodes={node.children} />;
        if (node.type === "link")
          return (
            <a
              key={node.id}
              href={node.href}
              target="_blank"
              rel="noreferrer"
              className="text-[#c2411e] underline decoration-[#c2411e]/40 underline-offset-2 hover:decoration-[#c2411e]"
            >
              {content}
            </a>
          );
        if (node.type === "strong") return <strong key={node.id} className="font-bold text-[#111410]">{content}</strong>;
        if (node.type === "emphasis") return <em key={node.id}>{content}</em>;
        return (
          <code key={node.id} className="bg-[#ede8dd] px-1.5 py-0.5 rounded text-[0.88em] font-mono text-[#8f2d13]">
            {content}
          </code>
        );
      })}
    </>
  );
}

function Bilingual({ content, showOriginal }: { content: InlineContainer; showOriginal: boolean }) {
  return (
    <>
      <InlineView nodes={content.translatedInline ?? content.inline} />
      {showOriginal && content.translatedInline && (
        <span className="source-text">
          <InlineView nodes={content.inline} />
        </span>
      )}
    </>
  );
}

export function ArticleNode({
  node,
  showOriginal,
  layout = "stacked",
  onOpenImage
}: {
  node: DocumentNode;
  showOriginal: boolean;
  layout?: ReaderLayout;
  onOpenImage?: (src: string) => void;
}) {
  const isSideBySide = layout === "side-by-side" && showOriginal;

  if (node.type === "image")
    return node.src ? (
      <figure className="my-8 flex flex-col items-center">
        <button
          type="button"
          onClick={() => {
            if (node.src) onOpenImage?.(node.id);
          }}
          className="block max-w-full group cursor-zoom-in text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c2411e]/50 rounded-lg"
          title="點擊放大檢視圖片"
        >
          <img
            src={getProxiedImageUrl(node.src)}
            alt={node.alt ?? ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="rounded-lg max-w-full h-auto mx-auto object-contain border border-[#ded8cb] shadow-xs group-hover:shadow-md transition-all group-hover:scale-[1.01]"
            onError={(e) => {
              if (node.src && e.currentTarget.src !== node.src) {
                e.currentTarget.src = node.src;
              }
            }}
          />
        </button>
        {node.alt && (
          <figcaption className="text-xs text-[#70756b] mt-2.5 text-center font-sans max-w-xl">
            {node.alt}
          </figcaption>
        )}
      </figure>
    ) : null;

  if (node.type === "divider") {
    const textNode = node.inline?.find((i): i is { type: "text"; text: string } => i.type === "text" && Boolean(i.text.trim()));
    const label = textNode?.text;
    if (label) {
      return (
        <div className="my-12 flex items-center gap-4 text-xs font-mono text-[#8a8e84]">
          <div className="flex-1 border-t border-[#ded8cb]" />
          <span className="px-2.5 py-0.5 rounded-full bg-[#eee8de] border border-[#ded7ca] text-[11px] font-medium text-[#6e7269] tracking-wide">
            {label}
          </span>
          <div className="flex-1 border-t border-[#ded8cb]" />
        </div>
      );
    }
    return <hr className="my-8 border-t border-[#ded8cb]" />;
  }

  if (node.type === "code")
    return (
      <pre>
        <code>{node.code}</code>
      </pre>
    );

  if (node.type === "list") {
    if (isSideBySide) {
      return (
        <div className="space-y-2.5 my-6">
          {node.items?.map((item, index) => {
            const bullet = node.ordered ? `${index + 1}.` : "•";
            return (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 py-1.5 border-b border-[#ded8cb]/20 hover:bg-[#efebe2]/30 rounded-md px-2.5 -mx-2.5 transition-colors"
              >
                <div className="flex gap-2.5 text-[#1a1d18] leading-relaxed">
                  <span className="font-mono text-xs text-[#888c83] shrink-0 pt-1 select-none">{bullet}</span>
                  <div><InlineView nodes={item.translatedInline ?? item.inline} /></div>
                </div>
                <div className="flex gap-2.5 text-[#64685f] font-sans text-[0.95em] leading-relaxed">
                  <span className="font-mono text-xs text-[#888c83] shrink-0 pt-1 select-none">{bullet}</span>
                  <div><InlineView nodes={item.inline} /></div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    const List = node.ordered ? "ol" : "ul";
    return (
      <List className={`pl-6 space-y-2 mb-6 ${node.ordered ? "list-decimal" : "list-disc"}`}>
        {node.items?.map((item, index) => (
          <li key={index}>
            <Bilingual content={item} showOriginal={showOriginal} />
          </li>
        ))}
      </List>
    );
  }

  if (node.type === "table")
    return (
      <div className="overflow-x-auto my-6 border border-[#ded8cb] rounded-lg bg-[#fbf9f4]">
        <table>
          <tbody>
            {node.rows?.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>
                    <Bilingual content={cell} showOriginal={showOriginal} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  // Heading node
  if (node.type === "heading") {
    const Heading = `h${Math.min(Math.max(node.level ?? 2, 2), 4)}` as "h2" | "h3" | "h4";
    if (isSideBySide && node.translatedInline) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 items-baseline pt-4 pb-2 border-b border-[#ded8cb]/60 mt-8 mb-4">
          <Heading className="!m-0 !border-0 !p-0">
            <InlineView nodes={node.translatedInline} />
          </Heading>
          <div className="text-[#64685f] font-sans font-medium text-[0.92em] leading-snug">
            <InlineView nodes={node.inline} />
          </div>
        </div>
      );
    }
    const content = <Bilingual content={node} showOriginal={showOriginal} />;
    return <Heading>{content}</Heading>;
  }

  // Blockquote node
  if (node.type === "blockquote") {
    if (isSideBySide && node.translatedInline) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 my-6">
          <blockquote className="border-l-3 border-[#c2411e] pl-4 italic text-[#1a1d18] leading-relaxed !my-0">
            <InlineView nodes={node.translatedInline} />
          </blockquote>
          <blockquote className="border-l-2 border-[#d5cebf] pl-4 italic text-[#64685f] font-sans text-[0.95em] leading-relaxed !my-0">
            <InlineView nodes={node.inline} />
          </blockquote>
        </div>
      );
    }
    const content = <Bilingual content={node} showOriginal={showOriginal} />;
    return <blockquote>{content}</blockquote>;
  }

  // Paragraph node
  if (isSideBySide && node.translatedInline) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 py-2.5 border-b border-[#ded8cb]/25 hover:bg-[#efebe2]/30 rounded-md px-2.5 -mx-2.5 transition-colors">
        <div className="text-[#1a1d18] leading-[1.8] text-[1.12rem]">
          <InlineView nodes={node.translatedInline} />
        </div>
        <div className="text-[#64685f] font-sans text-[0.96rem] leading-[1.65] pt-0.5">
          <InlineView nodes={node.inline} />
        </div>
      </div>
    );
  }

  const content = <Bilingual content={node} showOriginal={showOriginal} />;
  return <p>{content}</p>;
}
