import mjml2html from "mjml";
import { ALLOWED_MERGE_FIELDS, isAllowedLinkUrl, type Align, type Block, type EmailDesign, type SimpleBlock } from "./template-design";

/**
 * Server-authoritative email compiler: design JSON → responsive HTML (via MJML)
 * + plain-text fallback. Merge tokens are preserved as `{{token}}` placeholders
 * and resolved PER RECIPIENT (HTML-escaped) at send time. No scripts, iframes, or
 * arbitrary user HTML are ever produced.
 */

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Restricted, safe markdown → HTML: escape first, then introduce only known tags. */
function renderTextContent(raw: string): string {
  const paragraphs = raw.split(/\n{2,}/);
  return paragraphs
    .map((para) => {
      let html = escapeHtml(para);
      // [label](url) — url validated; falls back to the label when unsafe.
      html = html.replace(/\[([^\]]{1,200})\]\(([^)\s]{1,2000})\)/g, (_m, label: string, url: string) =>
        isAllowedLinkUrl(url) ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label,
      );
      html = html.replace(/\*\*([^*]{1,500})\*\*/g, "<strong>$1</strong>");
      html = html.replace(/(^|[^*])\*([^*\n]{1,500})\*(?!\*)/g, "$1<em>$2</em>");
      html = html.replace(/\n/g, "<br />");
      return html;
    })
    .join("<br /><br />");
}

const HEADING_SIZE: Record<1 | 2 | 3, string> = { 1: "28px", 2: "22px", 3: "18px" };

function simpleToMjml(b: SimpleBlock, design: EmailDesign): string {
  const a = (align: Align) => `align="${align}"`;
  switch (b.type) {
    case "text":
      return `<mj-text ${a(b.align)}>${renderTextContent(b.content)}</mj-text>`;
    case "heading":
      return `<mj-text ${a(b.align)} font-size="${HEADING_SIZE[b.level]}" font-weight="700" line-height="1.3">${escapeHtml(b.content)}</mj-text>`;
    case "image": {
      const width = Math.round((design.settings.contentWidth * b.widthPct) / 100);
      const href = b.href ? ` href="${escapeHtml(b.href)}"` : "";
      return `<mj-image src="${escapeHtml(b.src)}" alt="${escapeHtml(b.alt)}" ${a(b.align)} width="${width}px"${href} />`;
    }
    case "button":
      return `<mj-button href="${escapeHtml(b.href)}" ${a(b.align)} background-color="${b.backgroundColor}" color="${b.textColor}" border-radius="${b.radius}px">${escapeHtml(b.label)}</mj-button>`;
    case "divider":
      return `<mj-divider border-color="#e4d2bb" border-width="1px" />`;
    case "spacer":
      return `<mj-spacer height="${b.height}px" />`;
  }
}

function blockToMjml(b: Block, design: EmailDesign): string {
  if (b.type === "columns") {
    const cols = b.columns.map((col) => `<mj-column>${col.map((cb) => simpleToMjml(cb, design)).join("")}</mj-column>`).join("");
    return `<mj-section padding="0">${cols}</mj-section>`;
  }
  return `<mj-section padding="0"><mj-column>${simpleToMjml(b, design)}</mj-column></mj-section>`;
}

export interface CompileResult {
  html: string;
  text: string;
}

/** Compile a validated design into responsive HTML + a plain-text fallback. */
export function compileDesign(design: EmailDesign, opts: { preheader?: string } = {}): CompileResult {
  const s = design.settings;
  const preheader = opts.preheader?.trim() ? `<mj-raw><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.preheader.trim())}</div></mj-raw>` : "";
  const footer = `<mj-section padding="16px 0 0"><mj-column><mj-divider border-color="#e4d2bb" border-width="1px" /><mj-text align="center" font-size="12px" color="#5e4a38">You are receiving this because you opted in to Nonni's communications.<br /><a href="{{unsubscribeUrl}}" style="color:#5e4a38;">Unsubscribe</a></mj-text></mj-column></mj-section>`;

  const body = design.blocks.map((b) => blockToMjml(b, design)).join("");
  const markup = `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="${s.fontFamily}" />
      <mj-text color="${s.textColor}" font-size="15px" line-height="1.6" />
    </mj-attributes>
    <mj-style>a { color: ${s.linkColor}; }</mj-style>
  </mj-head>
  <mj-body background-color="${s.backgroundColor}" width="${s.contentWidth}px">
    ${preheader}
    <mj-wrapper background-color="${s.contentBackgroundColor}" padding="24px">
      ${body}
      ${footer}
    </mj-wrapper>
  </mj-body>
</mjml>`;

  const { html } = mjml2html(markup, { validationLevel: "soft" });
  return { html, text: designToText(design, opts.preheader) };
}

function designToText(design: EmailDesign, preheader?: string): string {
  const lines: string[] = [];
  if (preheader?.trim()) lines.push(preheader.trim(), "");
  const simpleText = (b: SimpleBlock) => {
    switch (b.type) {
      case "heading":
        lines.push(b.content.toUpperCase(), "");
        break;
      case "text":
        // Strip the markdown tokens for text, keep link URLs inline.
        lines.push(b.content.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)"), "");
        break;
      case "button":
        lines.push(`${b.label}: ${b.href}`, "");
        break;
      case "image":
        if (b.alt) lines.push(`[${b.alt}]`, "");
        break;
      case "divider":
        lines.push("----------------------------------------", "");
        break;
      case "spacer":
        break;
    }
  };
  for (const b of design.blocks) {
    if (b.type === "columns") b.columns.forEach((col) => col.forEach(simpleText));
    else simpleText(b);
  }
  lines.push("", "Unsubscribe: {{unsubscribeUrl}}");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

export interface MergeVars {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  organizationName?: string | null;
}

function mergeValue(field: string, vars: MergeVars): string {
  switch (field) {
    case "firstName":
      return vars.firstName ?? "";
    case "lastName":
      return vars.lastName ?? "";
    case "fullName":
      return [vars.firstName, vars.lastName].filter(Boolean).join(" ");
    case "email":
      return vars.email ?? "";
    case "organizationName":
      return vars.organizationName ?? "";
    default:
      return "";
  }
}

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Resolve `{{token}}` placeholders for one recipient. HTML output escapes every
 * merge value (a contact name can never inject markup); `unsubscribeUrl` is our
 * own URL. Text output uses plain values.
 */
export function renderForRecipient(compiled: CompileResult, vars: MergeVars, unsubscribeUrl: string): CompileResult {
  const resolve = (token: string, escape: boolean): string => {
    if (token === "unsubscribeUrl") return escape ? escapeHtml(unsubscribeUrl) : unsubscribeUrl;
    if ((ALLOWED_MERGE_FIELDS as readonly string[]).includes(token)) {
      const val = mergeValue(token, vars);
      return escape ? escapeHtml(val) : val;
    }
    return "";
  };
  return {
    html: compiled.html.replace(TOKEN_RE, (_m, t: string) => resolve(t, true)),
    text: compiled.text.replace(TOKEN_RE, (_m, t: string) => resolve(t, false)),
  };
}
