"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bold,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Undo2,
} from "lucide-react";
import {
  clearFormatting,
  insertHorizontalRule,
  insertLink,
  setHeading,
  toggleBlockquote,
  toggleBold,
  toggleBulletList,
  toggleInlineCode,
  toggleItalic,
  toggleOrderedList,
  type EditorState,
} from "@/lib/markdown-commands";
import { renderMarkdownPreview } from "@/lib/markdown";

type Command = (v: string, s: number, e: number) => EditorState;
type View = "write" | "preview" | "split";

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

export function MarkdownEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [view, setView] = useState<View>("write");

  // Undo/redo history at the editor layer.
  const history = useRef<{ stack: string[]; index: number; lastPush: number }>({ stack: [value], index: 0, lastPush: 0 });
  const pendingSel = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    // Restore caret/selection after a command-driven value change.
    if (pendingSel.current && taRef.current) {
      taRef.current.focus();
      taRef.current.setSelectionRange(pendingSel.current.start, pendingSel.current.end);
      pendingSel.current = null;
    }
  }, [value]);

  const pushHistory = useCallback((next: string, coalesce: boolean) => {
    const h = history.current;
    if (next === h.stack[h.index]) return;
    const now = Date.now();
    if (coalesce && now - h.lastPush < 500 && h.index === h.stack.length - 1) {
      h.stack[h.index] = next; // merge rapid typing into one entry
    } else {
      h.stack = h.stack.slice(0, h.index + 1);
      h.stack.push(next);
      h.index = h.stack.length - 1;
    }
    h.lastPush = now;
  }, []);

  const apply = useCallback(
    (command: Command) => {
      const ta = taRef.current;
      if (!ta) return;
      const { selectionStart, selectionEnd } = ta;
      const result = command(value, selectionStart, selectionEnd);
      pendingSel.current = { start: result.selStart, end: result.selEnd };
      pushHistory(result.value, false);
      onChange(result.value);
    },
    [value, onChange, pushHistory],
  );

  const applyHeading = useCallback(
    (level: 0 | 1 | 2 | 3 | 4 | 5 | 6) => apply((v, s, e) => setHeading(v, s, e, level)),
    [apply],
  );

  const doLink = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    if (!/^(https?:\/\/|mailto:)/i.test(url)) {
      window.alert("Enter a valid http(s):// or mailto: URL.");
      return;
    }
    apply((v, s, e) => insertLink(v, s, e, url));
  }, [apply]);

  const undo = useCallback(() => {
    const h = history.current;
    if (h.index > 0) {
      h.index--;
      onChange(h.stack[h.index]!);
    }
  }, [onChange]);

  const redo = useCallback(() => {
    const h = history.current;
    if (h.index < h.stack.length - 1) {
      h.index++;
      onChange(h.stack[h.index]!);
    }
  }, [onChange]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (e.altKey && HEADING_LEVELS.some((l) => String(l) === e.key)) {
      e.preventDefault();
      applyHeading(Number(e.key) as 1 | 2 | 3 | 4 | 5 | 6);
      return;
    }
    if (key === "b") { e.preventDefault(); apply(toggleBold); }
    else if (key === "i") { e.preventDefault(); apply(toggleItalic); }
    else if (key === "k") { e.preventDefault(); doLink(); }
    else if (key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((key === "z" && e.shiftKey) || key === "y") { e.preventDefault(); redo(); }
  };

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <div className="rounded-md border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5">
        <ToolButton label="Undo (⌘/Ctrl+Z)" onClick={undo}><Undo2 className="h-4 w-4" aria-hidden /></ToolButton>
        <ToolButton label="Redo (⌘/Ctrl+Shift+Z)" onClick={redo}><Redo2 className="h-4 w-4" aria-hidden /></ToolButton>
        <Divider />
        <select
          aria-label="Heading level"
          className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700 focus:border-brand-600 focus:outline-none"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") return;
            applyHeading(v === "p" ? 0 : (Number(v) as 1 | 2 | 3 | 4 | 5 | 6));
            e.currentTarget.value = "";
          }}
        >
          <option value="">Paragraph / Heading…</option>
          <option value="p">Paragraph</option>
          {HEADING_LEVELS.map((l) => <option key={l} value={l}>Heading {l}</option>)}
        </select>
        <Divider />
        <ToolButton label="Bold (⌘/Ctrl+B)" onClick={() => apply(toggleBold)}><Bold className="h-4 w-4" aria-hidden /></ToolButton>
        <ToolButton label="Italic (⌘/Ctrl+I)" onClick={() => apply(toggleItalic)}><Italic className="h-4 w-4" aria-hidden /></ToolButton>
        <ToolButton label="Inline code" onClick={() => apply(toggleInlineCode)}><Code className="h-4 w-4" aria-hidden /></ToolButton>
        <Divider />
        <ToolButton label="Bullet list" onClick={() => apply(toggleBulletList)}><List className="h-4 w-4" aria-hidden /></ToolButton>
        <ToolButton label="Numbered list" onClick={() => apply(toggleOrderedList)}><ListOrdered className="h-4 w-4" aria-hidden /></ToolButton>
        <ToolButton label="Blockquote" onClick={() => apply(toggleBlockquote)}><Quote className="h-4 w-4" aria-hidden /></ToolButton>
        <Divider />
        <ToolButton label="Link (⌘/Ctrl+K)" onClick={doLink}><Link2 className="h-4 w-4" aria-hidden /></ToolButton>
        <ToolButton label="Horizontal rule" onClick={() => apply(insertHorizontalRule)}><Minus className="h-4 w-4" aria-hidden /></ToolButton>
        <ToolButton label="Clear formatting" onClick={() => apply(clearFormatting)}><RemoveFormatting className="h-4 w-4" aria-hidden /></ToolButton>

        <div className="ml-auto flex rounded-md border border-slate-200 p-0.5">
          {(["write", "split", "preview"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${view === v ? "bg-brand-600 text-white" : "text-slate-500 hover:text-umber"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className={view === "split" ? "grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-slate-200" : ""}>
        {view !== "preview" ? (
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => { pushHistory(e.target.value, true); onChange(e.target.value); }}
            onKeyDown={onKeyDown}
            rows={18}
            className="w-full resize-y border-0 px-3 py-3 font-mono text-[13px] leading-relaxed text-slate-800 focus:outline-none focus:ring-0"
            placeholder="Write your article in Markdown…"
          />
        ) : null}
        {view !== "write" ? (
          <div className="prose-preview max-h-[520px] overflow-y-auto px-4 py-3">{renderMarkdownPreview(value)}</div>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 px-3 py-1.5 text-xs text-slate-400">
        <span>Markdown · selection-aware toolbar · ⌘/Ctrl+B/I/K, ⌘/Ctrl+Alt+1–6</span>
        <span>{words} word{words === 1 ? "" : "s"} · {value.length} chars</span>
      </div>
    </div>
  );
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-100 hover:text-umber focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden />;
}
