import type { PrismaService } from "../../../database/prisma.service";
import type { AuditService } from "../../audit/audit.service";
import { DeliveryOperationsService } from "./delivery-operations.service";
import type { RequestUser } from "../../auth/request-user";

const user = { id: "user-1" } as unknown as RequestUser;

function build(row: Record<string, unknown> | null, rows: Array<Record<string, unknown>> = []) {
  const recipientUpdate = jest.fn().mockResolvedValue({});
  const messageUpdate = jest.fn().mockResolvedValue({});
  const campaignUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma = {
    $queryRaw: jest.fn().mockImplementation(() => Promise.resolve(rows.length ? rows : [{ count: 0n }])),
    $transaction: jest.fn().mockResolvedValue([]),
    communicationEmailCampaignRecipient: { findUnique: jest.fn().mockResolvedValue(row), update: recipientUpdate },
    communicationSmsCampaignRecipient: { findUnique: jest.fn().mockResolvedValue(row), update: recipientUpdate },
    communicationMessage: { findUnique: jest.fn().mockResolvedValue(row), update: messageUpdate },
    communicationEmailCampaign: { updateMany: campaignUpdateMany },
    communicationSmsCampaign: { updateMany: campaignUpdateMany },
  } as unknown as PrismaService;
  const audit = { record: jest.fn().mockResolvedValue({}) } as unknown as AuditService;
  return { svc: new DeliveryOperationsService(prisma, audit), prisma, messageUpdate, audit };
}

/** Reach the private policy the way the API exposes it. */
const eligibility = (svc: DeliveryOperationsService, status: string, code: string | null) =>
  (svc as unknown as { retryEligibility: (s: string, c: string | null) => { allowed: boolean; requiresConfirmation: boolean; reason: string } }).retryEligibility(status, code);

describe("delivery retry policy", () => {
  const { svc } = build(null);

  it("never offers a quiet one-click resend for an ambiguous delivery", () => {
    const r = eligibility(svc, "DELIVERY_UNKNOWN", "TIMEOUT");
    expect(r.allowed).toBe(true);
    expect(r.requiresConfirmation).toBe(true);
    expect(r.reason).toMatch(/twice|duplicate/i);
  });

  it("refuses to retry a recipient the carrier rejected", () => {
    expect(eligibility(svc, "BOUNCED", "HARD_BOUNCE").allowed).toBe(false);
    expect(eligibility(svc, "UNDELIVERED", "30003").allowed).toBe(false);
  });

  it("refuses to retry a permanently bad recipient or an opted-out number", () => {
    expect(eligibility(svc, "FAILED", "MOCK_BOUNCE").allowed).toBe(false);
    expect(eligibility(svc, "FAILED", "21610").allowed).toBe(false);
    expect(eligibility(svc, "FAILED", "SMS_SUPPRESSED").allowed).toBe(false);
  });

  it("allows an unconfirmed retry when nothing was ever sent", () => {
    const config = eligibility(svc, "FAILED", "AUTH");
    expect(config).toMatchObject({ allowed: true, requiresConfirmation: false });
    const transient = eligibility(svc, "FAILED", "LEASE_RECOVERY_EXHAUSTED");
    expect(transient).toMatchObject({ allowed: true, requiresConfirmation: false });
  });
});

describe("DeliveryOperationsService.retry", () => {
  it("rejects a retry the policy forbids, without touching the record", async () => {
    const { svc, messageUpdate } = build({ status: "BOUNCED", lastErrorCode: "HARD_BOUNCE", conversationId: "conv-1", direction: "OUTBOUND" });
    await expect(svc.retry(user, "EMAIL_REPLY", "m1", false)).rejects.toThrow(/rejected this recipient/i);
    expect(messageUpdate).not.toHaveBeenCalled();
  });

  it("refuses an ambiguous retry until the duplicate risk is acknowledged", async () => {
    const { svc, messageUpdate } = build({ status: "DELIVERY_UNKNOWN", lastErrorCode: "TIMEOUT", conversationId: "conv-1", direction: "OUTBOUND" });
    await expect(svc.retry(user, "EMAIL_REPLY", "m1", false)).rejects.toThrow(/already have been delivered/i);
    expect(messageUpdate).not.toHaveBeenCalled();
  });

  it("re-queues an ambiguous message once the risk is acknowledged", async () => {
    const { svc, messageUpdate, audit } = build({ status: "DELIVERY_UNKNOWN", lastErrorCode: "TIMEOUT", conversationId: "conv-1", direction: "OUTBOUND" });
    await svc.retry(user, "EMAIL_REPLY", "m1", true);
    expect(messageUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "QUEUED", dispatchedAt: null, claimToken: null }) }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "communication.delivery.retried" }));
  });

  it("never trusts the client: an inbound message id is not retryable", async () => {
    const { svc } = build({ status: "RECEIVED", lastErrorCode: null, conversationId: "conv-1", direction: "INBOUND" });
    await expect(svc.retry(user, "EMAIL_REPLY", "m1", true)).rejects.toThrow(/not found/i);
  });
});

describe("retry policy for attachment failures", () => {
  const { svc } = build(null);

  it("allows a retry when a file could not be read", () => {
    // Object storage can be briefly unavailable. Refusing the retry left the
    // operator holding a dead message with no way to recover it.
    expect(eligibility(svc, "FAILED", "ATTACHMENT_UNAVAILABLE").allowed).toBe(true);
  });

  it("still refuses a retry for a genuinely dead recipient", () => {
    expect(eligibility(svc, "FAILED", "HARD_BOUNCE").allowed).toBe(false);
    expect(eligibility(svc, "FAILED", "NO_RECIPIENT").allowed).toBe(false);
    expect(eligibility(svc, "BOUNCED", null).allowed).toBe(false);
  });
});
