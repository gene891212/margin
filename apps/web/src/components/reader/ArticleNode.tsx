import type { DocumentNode, InlineContainer, InlineNode } from "../../types";

function getProxiedImageUrl(src?: string): string {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("/")) return src;
  return `/v1/image-proxy?url=${encodeURIComponent(src)}`;
}

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

export function ArticleNode({ node, showOriginal }: { node: DocumentNode; showOriginal: boolean }) {
  if (node.type === "image")
    return node.src ? (
      <figure className="my-8 flex flex-col items-center">
        <a
          href={node.src}
          target="_blank"
          rel="noreferrer"
          className="block max-w-full group cursor-zoom-in"
          title="點擊查看完整原圖"
        >
          <img
            src={getProxiedImageUrl(node.src)}
            alt={node.alt ?? ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="rounded-lg max-w-full h-auto mx-auto object-contain border border-[#ded8cb] shadow-xs group-hover:shadow-md transition-shadow"
            onError={(e) => {
              if (node.src && e.currentTarget.src !== node.src) {
                e.currentTarget.src = node.src;
              }
            }}
          />
        </a>
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
  const content = <Bilingual content={node} showOriginal={showOriginal} />;
  if (node.type === "heading") {
    const Heading = `h${Math.min(Math.max(node.level ?? 2, 2), 4)}` as "h2" | "h3" | "h4";
    return <Heading>{content}</Heading>;
  }
  if (node.type === "blockquote") return <blockquote>{content}</blockquote>;
  return <p>{content}</p>;
}
