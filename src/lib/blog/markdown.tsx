import type { ReactNode } from "react";

/**
 * A deliberately small, safe Markdown subset renderer for blog article bodies.
 *
 * It NEVER interprets raw HTML — every piece of text becomes a React text node
 * (React escapes it), and only a fixed set of elements is ever produced. This
 * removes any stored-XSS surface while still giving editors the practical
 * formatting an article needs: headings, paragraphs, bullet/numbered lists,
 * bold/italic, and links (http/https/mailto only).
 *
 * Not a full CommonMark implementation and intentionally so — no images, tables,
 * code fences, or embedded HTML. Keep the admin editor within this subset.
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

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "p", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed === "") {
      flushParagraph();
      continue;
    }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      flushParagraph();
      // Clamp to h2–h4 so the article never competes with the page <h1>.
      const level = Math.min(4, Math.max(2, heading[1]!.length)) as 2 | 3 | 4;
      blocks.push({ kind: "heading", level, text: heading[2]!.trim() });
      continue;
    }

    if (UL_ITEM.test(trimmed) || OL_ITEM.test(trimmed)) {
      flushParagraph();
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
  flushParagraph();
  return blocks;
}

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

/** Parse inline emphasis + safe links into React nodes. Text is always escaped by React. */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Tokenize on **bold**, *italic*/_italic_, and [label](url).
  const pattern = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(_([^_]+)_)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[2] !== undefined) {
      nodes.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key++}>{match[4]}</em>);
    } else if (match[6] !== undefined) {
      nodes.push(<em key={key++}>{match[6]}</em>);
    } else if (match[8] !== undefined) {
      const label = match[8];
      const href = match[9] ?? "";
      if (SAFE_LINK.test(href)) {
        const external = /^https?:/i.test(href);
        nodes.push(
          <a
            key={key++}
            href={href}
            className="font-medium text-coral underline decoration-coral/40 underline-offset-2 hover:decoration-coral"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {label}
          </a>,
        );
      } else {
        // Unsafe scheme (javascript:, data:, etc.) — render the label as plain text.
        nodes.push(label);
      }
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Render a trusted-authored Markdown-subset string to safe React nodes. */
export function renderMarkdown(md: string): ReactNode {
  const blocks = parseBlocks(md ?? "");
  return blocks.map((block, i) => {
    switch (block.kind) {
      case "heading": {
        const cls =
          block.level === 2
            ? "mt-10 font-display text-2xl font-medium text-navy sm:text-3xl"
            : block.level === 3
              ? "mt-8 font-display text-xl font-medium text-navy sm:text-2xl"
              : "mt-6 font-display text-lg font-medium text-navy";
        if (block.level === 2) return <h2 key={i} className={cls}>{renderInline(block.text)}</h2>;
        if (block.level === 3) return <h3 key={i} className={cls}>{renderInline(block.text)}</h3>;
        return <h4 key={i} className={cls}>{renderInline(block.text)}</h4>;
      }
      case "ul":
        return (
          <ul key={i} className="mt-4 list-disc space-y-2 pl-6 text-slate-ink">
            {block.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
          </ul>
        );
      case "ol":
        return (
          <ol key={i} className="mt-4 list-decimal space-y-2 pl-6 text-slate-ink">
            {block.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
          </ol>
        );
      case "p":
      default:
        return <p key={i} className="mt-5 text-lg leading-relaxed text-slate-ink">{renderInline(block.text)}</p>;
    }
  });
}
