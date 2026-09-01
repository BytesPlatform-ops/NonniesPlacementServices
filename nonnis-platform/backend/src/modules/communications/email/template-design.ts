import { BadRequestException } from "@nestjs/common";

/**
 * Controlled, versioned block design schema for email templates. Users never
 * author raw HTML — the visual builder produces this JSON and the backend
 * compiler owns the generated HTML. This keeps email markup safe and consistent
 * (no scripts, no iframes, no arbitrary style/HTML injection).
 */

export const DESIGN_VERSION = 1;

/** Merge fields the compiler will resolve. NEVER add Patient/Case/clinical fields. */
export const ALLOWED_MERGE_FIELDS = ["firstName", "lastName", "fullName", "email", "organizationName"] as const;
export type MergeField = (typeof ALLOWED_MERGE_FIELDS)[number];
/** System token resolved to the per-recipient public unsubscribe URL. */
export const SYSTEM_TOKENS = ["unsubscribeUrl"] as const;

const EMAIL_SAFE_FONTS = new Set([
  "Arial, Helvetica, sans-serif",
  "Helvetica, Arial, sans-serif",
  "Georgia, 'Times New Roman', serif",
  "'Trebuchet MS', Tahoma, sans-serif",
  "Tahoma, Verdana, sans-serif",
  "Verdana, Geneva, sans-serif",
]);

export type Align = "left" | "center" | "right";
const ALIGNS: Align[] = ["left", "center", "right"];

export interface EmailDesignSettings {
  backgroundColor: string;
  contentBackgroundColor: string;
  contentWidth: number;
  textColor: string;
  linkColor: string;
  fontFamily: string;
}

export type SimpleBlock =
  | { id: string; type: "text"; content: string; align: Align }
  | { id: string; type: "heading"; content: string; level: 1 | 2 | 3; align: Align }
  | { id: string; type: "image"; src: string; alt: string; align: Align; widthPct: number; href?: string }
  | { id: string; type: "button"; label: string; href: string; align: Align; backgroundColor: string; textColor: string; radius: number }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height: number };

export type Block = SimpleBlock | { id: string; type: "columns"; columns: SimpleBlock[][] };

export interface EmailDesign {
  version: number;
  settings: EmailDesignSettings;
  blocks: Block[];
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MERGE_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function str(v: unknown, field: string, max = 20_000): string {
  if (typeof v !== "string") throw new BadRequestException(`${field} must be a string`);
  if (v.length > max) throw new BadRequestException(`${field} is too long`);
  return v;
}
function hex(v: unknown, field: string): string {
  const s = str(v, field, 9);
  if (!HEX.test(s)) throw new BadRequestException(`${field} must be a hex color`);
  return s;
}
function align(v: unknown): Align {
  if (!ALIGNS.includes(v as Align)) throw new BadRequestException("Invalid alignment");
  return v as Align;
}
function int(v: unknown, field: string, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new BadRequestException(`${field} must be ${min}–${max}`);
  return Math.round(n);
}

/** Only absolute http(s) URLs are allowed (email clients require them). */
export function isAllowedLinkUrl(url: string, requireHttps = false): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === "mailto:") return true;
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:") return !requireHttps;
    return false;
  } catch {
    return false;
  }
}
/** Images must be absolute, publicly reachable HTTPS URLs (no localhost / relative). */
export function isAllowedImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (/^(localhost|127\.|0\.0\.0\.0)/.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function validateSimple(b: unknown, requireProdMedia: boolean): SimpleBlock {
  if (!b || typeof b !== "object") throw new BadRequestException("Invalid block");
  const raw = b as Record<string, unknown>;
  const id = str(raw.id, "block.id", 64);
  switch (raw.type) {
    case "text":
      return { id, type: "text", content: str(raw.content, "text.content"), align: align(raw.align ?? "left") };
    case "heading":
      return { id, type: "heading", content: str(raw.content, "heading.content", 500), level: [1, 2, 3].includes(raw.level as number) ? (raw.level as 1 | 2 | 3) : 2, align: align(raw.align ?? "left") };
    case "image": {
      const src = str(raw.src, "image.src", 2000);
      if (src && requireProdMedia && !isAllowedImageUrl(src)) throw new BadRequestException("Image URL must be an absolute HTTPS URL (no localhost/relative).");
      const href = raw.href ? str(raw.href, "image.href", 2000) : undefined;
      if (href && !isAllowedLinkUrl(href)) throw new BadRequestException("Invalid image link URL");
      return { id, type: "image", src, alt: str(raw.alt ?? "", "image.alt", 300), align: align(raw.align ?? "center"), widthPct: int(raw.widthPct ?? 100, "image.widthPct", 10, 100), href };
    }
    case "button": {
      const href = str(raw.href, "button.href", 2000);
      if (!isAllowedLinkUrl(href)) throw new BadRequestException("Button URL must be a valid http(s)/mailto URL.");
      return { id, type: "button", label: str(raw.label ?? "Button", "button.label", 120), href, align: align(raw.align ?? "center"), backgroundColor: hex(raw.backgroundColor ?? "#b56f28", "button.backgroundColor"), textColor: hex(raw.textColor ?? "#ffffff", "button.textColor"), radius: int(raw.radius ?? 6, "button.radius", 0, 40) };
    }
    case "divider":
      return { id, type: "divider" };
    case "spacer":
      return { id, type: "spacer", height: int(raw.height ?? 24, "spacer.height", 4, 200) };
    default:
      throw new BadRequestException(`Unknown block type "${String(raw.type)}"`);
  }
}

/**
 * Validate and normalize a design. `requireProdMedia` enforces
 * production-suitable image URLs (used at campaign queue time, relaxed while
 * drafting a template).
 */
export function validateDesign(input: unknown, requireProdMedia = false): EmailDesign {
  if (!input || typeof input !== "object") throw new BadRequestException("Design must be an object");
  const raw = input as Record<string, unknown>;
  const s = (raw.settings ?? {}) as Record<string, unknown>;
  const font = typeof s.fontFamily === "string" && EMAIL_SAFE_FONTS.has(s.fontFamily) ? s.fontFamily : "Arial, Helvetica, sans-serif";
  const settings: EmailDesignSettings = {
    backgroundColor: hex(s.backgroundColor ?? "#f2e8db", "settings.backgroundColor"),
    contentBackgroundColor: hex(s.contentBackgroundColor ?? "#ffffff", "settings.contentBackgroundColor"),
    contentWidth: int(s.contentWidth ?? 600, "settings.contentWidth", 320, 800),
    textColor: hex(s.textColor ?? "#2b1b0e", "settings.textColor"),
    linkColor: hex(s.linkColor ?? "#b56f28", "settings.linkColor"),
    fontFamily: font,
  };
  const blocksRaw = Array.isArray(raw.blocks) ? raw.blocks : [];
  if (blocksRaw.length > 200) throw new BadRequestException("Too many blocks");
  const blocks: Block[] = blocksRaw.map((b) => {
    const rec = b as Record<string, unknown>;
    if (rec?.type === "columns") {
      const cols = Array.isArray(rec.columns) ? rec.columns : [];
      if (cols.length < 1 || cols.length > 2) throw new BadRequestException("A columns block must have 1 or 2 columns");
      return { id: str(rec.id, "block.id", 64), type: "columns", columns: cols.map((col) => (Array.isArray(col) ? col.map((cb) => validateSimple(cb, requireProdMedia)) : [])) };
    }
    return validateSimple(b, requireProdMedia);
  });
  return { version: DESIGN_VERSION, settings, blocks };
}

/** All merge tokens used anywhere in the design's text/heading/button content. */
export function collectMergeTokens(design: EmailDesign): string[] {
  const found = new Set<string>();
  const scan = (text: string) => {
    for (const m of text.matchAll(MERGE_RE)) found.add(m[1]);
  };
  const scanSimple = (b: SimpleBlock) => {
    if (b.type === "text" || b.type === "heading") scan(b.content);
    if (b.type === "button") scan(b.label);
  };
  for (const b of design.blocks) {
    if (b.type === "columns") b.columns.forEach((col) => col.forEach(scanSimple));
    else scanSimple(b);
  }
  return [...found];
}

/** Reject any merge token that is not an allowed Communications field/system token. */
export function assertMergeTokensAllowed(design: EmailDesign): void {
  const allowed = new Set<string>([...ALLOWED_MERGE_FIELDS, ...SYSTEM_TOKENS]);
  const unknown = collectMergeTokens(design).filter((t) => !allowed.has(t));
  if (unknown.length > 0) {
    throw new BadRequestException(`Unknown merge field(s): ${unknown.map((u) => `{{${u}}}`).join(", ")}. Allowed: ${[...ALLOWED_MERGE_FIELDS].map((f) => `{{${f}}}`).join(", ")}.`);
  }
}
