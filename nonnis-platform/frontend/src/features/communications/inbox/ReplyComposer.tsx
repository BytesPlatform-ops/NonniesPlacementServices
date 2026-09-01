"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Paperclip, Send, X, Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/providers/toast-provider";
import { replyToConversation, uploadReplyAttachment } from "@/services/communications-inbox.service";
import type { ReplyAttachmentRef } from "@/types/communications-inbox";
import { formatBytes } from "./inbox-format";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp";
const MAX_ATTACHMENTS = 5;

export function ReplyComposer({ conversationId, disabled, disabledReason, onSent }: { conversationId: string; disabled?: boolean; disabledReason?: string; onSent: () => void }) {
  const toast = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<ReplyAttachmentRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const surround = (before: string, after: string, placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end) || placeholder;
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  };

  const prefixLines = (prefix: (i: number) => string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const block = body.slice(start, end) || "item";
    const out = block.split("\n").map((l, i) => `${prefix(i)}${l}`).join("\n");
    setBody(body.slice(0, start) + out + body.slice(end));
    requestAnimationFrame(() => el.focus());
  };

  const insertLink = () => {
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    surround("[", `](${url})`, "link text");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); surround("**", "**", "bold"); }
    else if (k === "i") { e.preventDefault(); surround("*", "*", "italic"); }
    else if (k === "k") { e.preventDefault(); insertLink(); }
    else if (k === "enter") { e.preventDefault(); void send(); }
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) { toast.error(`Up to ${MAX_ATTACHMENTS} attachments.`); return; }
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, room)) {
        const ref = await uploadReplyAttachment(file);
        setAttachments((prev) => [...prev, ref]);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Attachment upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const send = async () => {
    if (sending || !body.trim()) return;
    setSending(true);
    try {
      await replyToConversation(conversationId, body.trim(), attachments);
      setBody("");
      setAttachments([]);
      toast.success("Reply queued");
      onSent();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Unable to send reply.");
    } finally {
      setSending(false);
    }
  };

  if (disabled) {
    return <div className="border-t border-sage bg-ivory px-4 py-3 text-sm text-slate-500">{disabledReason ?? "Replying is not available for this conversation."}</div>;
  }

  const tool = "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-sage/40 hover:text-umber";

  return (
    <div className="border-t border-sage bg-white p-3">
      <div className="mb-2 flex items-center gap-1">
        <button type="button" className={tool} title="Bold (⌘B)" aria-label="Bold" onClick={() => surround("**", "**", "bold")}><Bold className="h-4 w-4" aria-hidden /></button>
        <button type="button" className={tool} title="Italic (⌘I)" aria-label="Italic" onClick={() => surround("*", "*", "italic")}><Italic className="h-4 w-4" aria-hidden /></button>
        <button type="button" className={tool} title="Link (⌘K)" aria-label="Insert link" onClick={insertLink}><Link2 className="h-4 w-4" aria-hidden /></button>
        <button type="button" className={tool} title="Bullet list" aria-label="Bullet list" onClick={() => prefixLines(() => "- ")}><List className="h-4 w-4" aria-hidden /></button>
        <button type="button" className={tool} title="Numbered list" aria-label="Numbered list" onClick={() => prefixLines((i) => `${i + 1}. `)}><ListOrdered className="h-4 w-4" aria-hidden /></button>
        <div className="mx-1 h-5 w-px bg-sage" />
        <button type="button" className={tool} title="Attach file" aria-label="Attach file" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Paperclip className="h-4 w-4" aria-hidden />}</button>
        <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => void onPickFiles(e.target.files)} />
      </div>

      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        rows={4}
        placeholder="Write a reply…  **bold**, *italic*, [link](url), - bullets"
        className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
      />

      {attachments.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <span key={a.path} className="inline-flex items-center gap-1.5 rounded-md border border-sage bg-ivory px-2 py-1 text-xs text-slate-700">
              <Paperclip className="h-3.5 w-3.5" aria-hidden /> <span className="max-w-[12rem] truncate">{a.fileName}</span> <span className="text-slate-400">{formatBytes(a.sizeBytes)}</span>
              <button type="button" onClick={() => setAttachments((prev) => prev.filter((x) => x.path !== a.path))} className="text-slate-400 hover:text-rose-600" aria-label={`Remove ${a.fileName}`}><X className="h-3.5 w-3.5" aria-hidden /></button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-400">Sends from the verified Nonni&apos;s address. Replies route back here.</span>
        <button type="button" onClick={() => void send()} disabled={sending || uploading || !body.trim()} className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />} {sending ? "Sending…" : "Send Reply"}
        </button>
      </div>
    </div>
  );
}
