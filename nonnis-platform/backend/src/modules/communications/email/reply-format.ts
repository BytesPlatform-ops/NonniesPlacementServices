import { BadRequestException } from "@nestjs/common";
import { escapeHtml } from "./email-compiler";
import { isAllowedLinkUrl } from "./template-design";

/**
 * A CRM reply is authored as a small, controlled Markdown subset — never arbitrary
 * browser HTML. The backend is authoritative: it validates, then compiles to
 * email-safe HTML plus a plain-text fallback. Supported:
 *   - paragraphs (blank-line separated)
 *   - **bold**, *italic* / _italic_
 *   - [label](https|http|mailto url)
 *   - "- " / "* " bullet lists and "1." numbered lists
 * Everything else is treated as literal text (escaped). Unsafe link URLs are rejected.
 */

export const MAX_REPLY_CHARS = 25_000;

export interface CompiledReply {
  html: string;
  text: string;
}

interface InlineToken {
  html: string;
  text: string;
}

/** Escape then apply inline bold/italic/link. Operates on already-escaped safe text. */
function compileInline(raw: string): InlineToken {
  const text = raw;
  // Escape first so no raw markup survives.
  let html = escapeHtml(raw);

  // Links: [label](url) — validate the URL, escape the label.
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    // url/label are already HTML-escaped; decode entities only for URL validation.
    const decodedUrl = url.replace(/&amp;/g, "&");
    if (!isAllowedLinkUrl(decodedUrl)) return `${label}`; // drop unsafe link, keep label text
    const safeHref = escapeHtml(decodedUrl);
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // Bold then italic (bold first so **x** isn't eaten by italic).
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  html = html.replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>");

  return { html, text };
}

/** Strip markdown emphasis/link syntax for the plain-text alternative. */
function inlineToText(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => (isAllowedLinkUrl(url) ? `${label} (${url})` : label))
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1$2")
    .replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1$2");
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul"; items: string[] } | { kind: "ol"; items: string[] };

function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", lines: para });
    para = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (trimmed === "") {
      flushPara();
      continue;
    }
    if (bullet) {
      flushPara();
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "ul") last.items.push(bullet[1]!);
      else blocks.push({ kind: "ul", items: [bullet[1]!] });
      continue;
    }
    if (numbered) {
      flushPara();
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "ol") last.items.push(numbered[1]!);
      else blocks.push({ kind: "ol", items: [numbered[1]!] });
      continue;
    }
    para.push(trimmed);
  }
  flushPara();
  return blocks;
}

export function compileReply(markdown: string): CompiledReply {
  const source = (markdown ?? "").trim();
  if (!source) throw new BadRequestException("A reply message is required.");
  if (source.length > MAX_REPLY_CHARS) throw new BadRequestException("The reply is too long.");

  const blocks = parseBlocks(source);
  const htmlParts: string[] = [];
  const textParts: string[] = [];

  for (const b of blocks) {
    if (b.kind === "p") {
      htmlParts.push(`<p>${b.lines.map((l) => compileInline(l).html).join("<br />")}</p>`);
      textParts.push(b.lines.map(inlineToText).join("\n"));
    } else {
      const tag = b.kind === "ul" ? "ul" : "ol";
      htmlParts.push(`<${tag}>${b.items.map((i) => `<li>${compileInline(i).html}</li>`).join("")}</${tag}>`);
      textParts.push(b.items.map((i, idx) => `${b.kind === "ul" ? "-" : `${idx + 1}.`} ${inlineToText(i)}`).join("\n"));
    }
  }

  const inner = htmlParts.join("\n");
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#33302c;">${inner}</body></html>`;
  const text = textParts.join("\n\n");
  return { html, text };
}
