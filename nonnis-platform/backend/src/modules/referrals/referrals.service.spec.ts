import { BadRequestException, ConflictException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import type { RequestUser } from "../auth/request-user";
import { ReferralsService } from "./referrals.service";
import type { ReferralAccessService } from "./referral-access";
import type { ReferralMailService } from "./referral-mail.service";
import type { CreateReferralDto } from "./dto/referrals.dto";

const user = { id: "user-1" } as unknown as RequestUser;
const workflowEvents = { record: async () => undefined } as unknown as WorkflowEventsService;
const audit = { record: async () => undefined } as unknown as AuditService;
const mail = {} as unknown as ReferralMailService;
const access = { ensureCaseForCreate: async () => "org-1" } as unknown as ReferralAccessService;

const PROVIDER_ID = "22222222-2222-2222-2222-222222222222";

function build(prisma: unknown) {
  return new ReferralsService(prisma as PrismaService, workflowEvents, audit, access, mail);
}

describe("ReferralsService.create validation", () => {
  const dto: CreateReferralDto = { providerId: PROVIDER_ID };

  it("rejects a service request that does not belong to the case", async () => {
    const prisma = { serviceRequest: { findUnique: async () => ({ id: "sr-1", caseId: "other-case", status: "REQUESTED" }) } };
    await expect(build(prisma).create(user, "case-1", "sr-1", dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an inactive provider", async () => {
    const prisma = {
      serviceRequest: { findUnique: async () => ({ id: "sr-1", caseId: "case-1", status: "REQUESTED" }) },
      provider: { findUnique: async () => ({ id: PROVIDER_ID, status: "INACTIVE" }) },
    };
    await expect(build(prisma).create(user, "case-1", "sr-1", dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("prevents a duplicate active referral to the same provider", async () => {
    const prisma = {
      serviceRequest: { findUnique: async () => ({ id: "sr-1", caseId: "case-1", status: "REQUESTED" }) },
      provider: { findUnique: async () => ({ id: PROVIDER_ID, status: "ACTIVE" }) },
      referral: { findFirst: async () => ({ id: "existing" }) },
    };
    await expect(build(prisma).create(user, "case-1", "sr-1", dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it("locks the service request and rejects a referral that raced past the pre-check", async () => {
    // The pre-check sees nothing (concurrent sibling not committed yet); the
    // in-transaction re-check, taken after the row lock, sees the committed row.
    const executed: string[] = [];
    let preCheck = true;
    const tx = {
      $executeRaw: async (strings: TemplateStringsArray) => {
        executed.push(strings.join("?"));
        return 1;
      },
      referral: { findFirst: async () => ({ id: "committed-by-concurrent-request" }) },
    };
    const prisma = {
      serviceRequest: { findUnique: async () => ({ id: "sr-1", caseId: "case-1", status: "REQUESTED" }) },
      provider: { findUnique: async () => ({ id: PROVIDER_ID, status: "ACTIVE" }) },
      referral: {
        findFirst: async () => {
          if (preCheck) {
            preCheck = false;
            return null;
          }
          return { id: "existing" };
        },
      },
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    };

    await expect(build(prisma).create(user, "case-1", "sr-1", dto)).rejects.toBeInstanceOf(ConflictException);
    expect(executed.join(" ")).toMatch(/service_requests[\s\S]*FOR UPDATE/);
  });
});
