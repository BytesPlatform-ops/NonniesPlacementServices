import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../database/prisma.service";
import type { AppConfig } from "../../config/configuration";
import { ReferralMailService, type MailTransport } from "./referral-mail.service";

const config = { get: () => "https://app.example.com" } as unknown as ConfigService<AppConfig, true>;

function svc(prisma: unknown, transport: MailTransport) {
  return new ReferralMailService(prisma as PrismaService, config, transport);
}

const okTransport: MailTransport = { send: async () => undefined };
const failingTransport: MailTransport = {
  send: async () => {
    throw new Error("SMTP is not configured");
  },
};

const providerWithAdmins = {
  provider: { findUnique: async () => ({ email: "ops@prov.com", organizationId: "prov-org" }) },
  organizationMembership: {
    findMany: async () => [{ user: { email: "admin@prov.com", status: "ACTIVE" } }],
  },
} as unknown as PrismaService;

const providerNoAdmins = {
  provider: { findUnique: async () => ({ email: "ops@prov.com", organizationId: "prov-org" }) },
  organizationMembership: { findMany: async () => [] },
} as unknown as PrismaService;

const input = { referralId: "ref-1", reference: "REF-2026-ABCDEF", providerId: "prov-1" };

describe("ReferralMailService", () => {
  it("prefers active provider admin emails, else the provider email", async () => {
    expect(await svc(providerWithAdmins, okTransport).resolveRecipients("prov-1")).toEqual(["admin@prov.com"]);
    expect(await svc(providerNoAdmins, okTransport).resolveRecipients("prov-1")).toEqual(["ops@prov.com"]);
  });

  it("returns SENT on success", async () => {
    const r = await svc(providerWithAdmins, okTransport).sendReferralNotification(input);
    expect(r.status).toBe("SENT");
    expect(r.recipients).toEqual(["admin@prov.com"]);
  });

  it("returns FAILED (not throw) when the transport fails", async () => {
    const r = await svc(providerWithAdmins, failingTransport).sendReferralNotification(input);
    expect(r.status).toBe("FAILED");
    expect(r.error).toContain("SMTP");
  });

  it("returns FAILED when no recipient can be determined", async () => {
    const prisma = {
      provider: { findUnique: async () => ({ email: null, organizationId: "prov-org" }) },
      organizationMembership: { findMany: async () => [] },
    } as unknown as PrismaService;
    const r = await svc(prisma, okTransport).sendReferralNotification(input);
    expect(r.status).toBe("FAILED");
    expect(r.recipients).toEqual([]);
  });
});
