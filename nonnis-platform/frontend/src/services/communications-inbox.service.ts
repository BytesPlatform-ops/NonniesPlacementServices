import { apiGet, apiPost } from "@/lib/api-client";
import type { PaginatedResult } from "@/types/api";
import type {
  CommunicationChannel,
  ConversationDetail,
  ConversationListItem,
  InboundReviewView,
  InboxView,
  MessageView,
  ReplyAttachmentRef,
  ReviewStatus,
} from "@/types/communications-inbox";

const BASE = "/api/v1/communications";

function qs(f: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ---- Conversations ----
export function listConversations(f: { view: InboxView; channel?: CommunicationChannel; search?: string; page?: number; pageSize?: number }): Promise<PaginatedResult<ConversationListItem>> {
  return apiGet(`${BASE}/conversations${qs(f)}`);
}
export function getConversation(id: string): Promise<ConversationDetail> {
  return apiGet(`${BASE}/conversations/${id}`);
}
export function unreadCount(): Promise<{ count: number }> {
  return apiGet(`${BASE}/conversations/unread-count`);
}
export function markRead(id: string): Promise<{ ok: true }> {
  return apiPost(`${BASE}/conversations/${id}/read`);
}
export function markUnread(id: string): Promise<{ ok: true }> {
  return apiPost(`${BASE}/conversations/${id}/mark-unread`);
}
export function archiveConversation(id: string): Promise<{ ok: true }> {
  return apiPost(`${BASE}/conversations/${id}/archive`);
}
export function restoreConversation(id: string): Promise<{ ok: true }> {
  return apiPost(`${BASE}/conversations/${id}/restore`);
}
export function replyToConversation(id: string, body: string, attachments: ReplyAttachmentRef[]): Promise<{ conversationId: string; message: MessageView }> {
  return apiPost(`${BASE}/conversations/${id}/reply`, { body, attachments });
}
export function retryReply(conversationId: string, messageId: string): Promise<{ ok: true }> {
  return apiPost(`${BASE}/conversations/${conversationId}/messages/${messageId}/retry`);
}

// ---- Attachments ----
interface UploadTicket {
  path: string;
  token: string;
  signedUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

function putSignedUrl(signedUrl: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (HTTP ${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection and try again."));
    xhr.send(file);
  });
}

/** Validate + authorize on the backend, then upload the file directly to private storage. */
export async function uploadReplyAttachment(file: File): Promise<ReplyAttachmentRef> {
  const ticket = await apiPost<UploadTicket>(`${BASE}/conversations/attachments/upload-url`, { fileName: file.name, mimeType: file.type, sizeBytes: file.size });
  await putSignedUrl(ticket.signedUrl, file);
  return { path: ticket.path, fileName: ticket.fileName, mimeType: ticket.mimeType, sizeBytes: ticket.sizeBytes };
}

/** Fetch a short-lived signed URL and open it to download the attachment. */
export async function downloadAttachment(conversationId: string, attachmentId: string): Promise<void> {
  const { url } = await apiGet<{ url: string; fileName: string }>(`${BASE}/conversations/${conversationId}/attachments/${attachmentId}/download`);
  window.open(url, "_blank", "noopener,noreferrer");
}

// ---- Inbound review (quarantine) ----
export function listReviews(f: { status?: ReviewStatus; channel?: CommunicationChannel; page?: number; pageSize?: number }): Promise<PaginatedResult<InboundReviewView>> {
  return apiGet(`${BASE}/inbound-review${qs(f)}`);
}
export function reviewPendingCount(): Promise<{ count: number }> {
  return apiGet(`${BASE}/inbound-review/count`);
}
export function linkReview(id: string, target: { conversationId?: string; contactId?: string }): Promise<{ ok: true; conversationId: string }> {
  return apiPost(`${BASE}/inbound-review/${id}/link`, target);
}
export function dismissReview(id: string): Promise<{ ok: true }> {
  return apiPost(`${BASE}/inbound-review/${id}/dismiss`);
}
