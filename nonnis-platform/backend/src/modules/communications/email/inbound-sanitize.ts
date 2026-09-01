import sanitizeHtml from "sanitize-html";

/**
 * Inbound email is UNTRUSTED. We never render raw provider HTML. This produces a
 * conservative, allowlist-sanitized fragment safe for the CRM thread view:
 *  - scripts / iframes / forms / objects / embeds / event handlers are removed
 *  - javascript: and other unsafe URL schemes are dropped
 *  - inline styles are stripped (no CSS-based exfiltration/spoofing)
 *  - <img> is removed entirely so remote tracking pixels never load when staff
 *    open a message (opening a message must not notify the sender)
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "hr", "div", "span", "blockquote", "pre", "code",
    "strong", "b", "em", "i", "u", "s", "sub", "sup",
    "a", "ul", "ol", "li", "dl", "dt", "dd",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
  },
  // Only safe link schemes; everything else (javascript:, data:, vbscript:) dropped.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { a: ["http", "https", "mailto", "tel"] },
  disallowedTagsMode: "discard",
  allowProtocolRelative: false,
  enforceHtmlBoundary: true,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...(attribs.href ? { href: attribs.href } : {}), target: "_blank", rel: "noopener noreferrer nofollow" },
    }),
  },
};

/** Sanitize untrusted inbound HTML into a safe fragment (never raw). */
export function sanitizeInboundHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}

/** Best-effort plain text from an HTML body (used when the provider omits a text part). */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  const stripped = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return decodeEntities(stripped).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Short single-line preview for the Inbox list (never re-parses a big HTML body per row). */
export function buildPreviewText(text: string | null | undefined, fallbackHtml?: string | null): string {
  const base = (text && text.trim()) || htmlToPlainText(fallbackHtml);
  const oneLine = base.replace(/\s+/g, " ").trim();
  return oneLine.length > 160 ? `${oneLine.slice(0, 157)}…` : oneLine;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
