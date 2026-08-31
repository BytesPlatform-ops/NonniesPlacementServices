import type { ReactNode } from "react";

/**
 * Safe Markdown-subset renderer for the CMS editor PREVIEW. The parsing rules
 * are intentionally IDENTICAL to the public website's blog renderer
 * (`src/lib/blog/markdown.tsx` in the root app) so what an author previews is
 * what the public page renders. Never interprets raw HTML — every text node is
 * escaped by React and only a fixed set of elements is produced.
 */

type Block =
  | { kind: "heading"; level: 2 | 3 | 4; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "p"; text: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const UL_ITEM = /^[-*]\s+(.*)$/;
const OL_ITEM = /^\d+[.)]\s+(.*)$/;

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "p", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed === "") {
      flush();
      continue;
    }
    const heading = HEADING.exec(trimmed);
    if (heading) {
      flush();
      const level = Math.min(4, Math.max(2, heading[1]!.length)) as 2 | 3 | 4;
      blocks.push({ kind: "heading", level, text: heading[2]!.trim() });
      continue;
    }
    if (UL_ITEM.test(trimmed) || OL_ITEM.test(trimmed)) {
      flush();
      const ordered = OL_ITEM.test(trimmed);
      const items: string[] = [];
      let j = i;
      while (j < lines.length) {
        const t = lines[j]!.trim();
        const m = ordered ? OL_ITEM.exec(t) : UL_ITEM.exec(t);
        if (!m) break;
        items.push(m[1]!.trim());
        j++;
      }
      blocks.push(ordered ? { kind: "ol", items } : { kind: "ul", items });
      i = j - 1;
      continue;
    }
    paragraph.push(trimmed);
  }
  flush();
  return blocks;
}

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(_([^_]+)_)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[2] !== undefined) nodes.push(<strong key={key++}>{match[2]}</strong>);
    else if (match[4] !== undefined) nodes.push(<em key={key++}>{match[4]}</em>);
    else if (match[6] !== undefined) nodes.push(<em key={key++}>{match[6]}</em>);
    else if (match[8] !== undefined) nodes.push(<code key={key++} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] text-umber">{match[8]}</code>);
    else if (match[10] !== undefined) {
      const label = match[10];
      const href = match[11] ?? "";
      if (SAFE_LINK.test(href)) {
        nodes.push(<a key={key++} href={href} className="font-medium text-brand-700 underline" target="_blank" rel="noopener noreferrer">{label}</a>);
      } else {
        nodes.push(label);
      }
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Render a Markdown-subset string to safe React nodes for the editor preview. */
export function renderMarkdownPreview(md: string): ReactNode {
  const blocks = parseBlocks(md ?? "");
  if (blocks.length === 0) return <p className="text-sm text-slate-400">Nothing to preview yet.</p>;
  return blocks.map((block, i) => {
    switch (block.kind) {
      case "heading": {
        const cls =
          block.level === 2
            ? "mt-6 text-2xl font-semibold text-umber"
            : block.level === 3
              ? "mt-5 text-xl font-semibold text-umber"
              : "mt-4 text-lg font-semibold text-umber";
        if (block.level === 2) return <h2 key={i} className={cls}>{renderInline(block.text)}</h2>;
        if (block.level === 3) return <h3 key={i} className={cls}>{renderInline(block.text)}</h3>;
        return <h4 key={i} className={cls}>{renderInline(block.text)}</h4>;
      }
      case "ul":
        return <ul key={i} className="mt-3 list-disc space-y-1.5 pl-6 text-slate-ink">{block.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>;
      case "ol":
        return <ol key={i} className="mt-3 list-decimal space-y-1.5 pl-6 text-slate-ink">{block.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ol>;
      case "p":
      default:
        return <p key={i} className="mt-4 leading-relaxed text-slate-ink">{renderInline(block.text)}</p>;
    }
  });
}
