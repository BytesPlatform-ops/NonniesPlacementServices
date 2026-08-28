import { BadRequestException, NotFoundException, ServiceUnavailableException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import { PERMISSIONS } from "../../common/rbac";
import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import type { AppConfig } from "../../config/configuration";
import { FormSubmissionsService } from "./form-submissions.service";
import { FormSubmissionsController } from "./form-submissions.controller";
import { IngestTokenGuard } from "./ingest-token.guard";
import type { IngestFormSubmissionDto } from "./dto/form-submissions.dto";

const audit = { record: async () => undefined } as unknown as AuditService;
const user = { id: "user-1" } as unknown as RequestUser;

function baseIngest(over: Partial<IngestFormSubmissionDto> = {}): IngestFormSubmissionDto {
  return {
    reference: "HR-20260829-ABCDEF",
    formKey: "hospital_referral",
    formName: "Hospital Referral",
    submittedData: { sections: [] },
    ...over,
  } as IngestFormSubmissionDto;
}

describe("FormSubmissionsService.ingest", () => {
  it("persists a new submission", async () => {
    const prisma = {
      websiteFormSubmission: {
        findUnique: async () => null,
        create: async () => ({ id: "sub-1", reference: "HR-20260829-ABCDEF" }),
      },
    } as unknown as PrismaService;
    const svc = new FormSubmissionsService(prisma, audit);
    const r = await svc.ingest(baseIngest());
    expect(r).toEqual({ id: "sub-1", reference: "HR-20260829-ABCDEF", duplicate: false });
  });

  it("is idempotent on a duplicate reference", async () => {
    const prisma = {
      websiteFormSubmission: { findUnique: async () => ({ id: "sub-1", reference: "HR-20260829-ABCDEF" }) },
    } as unknown as PrismaService;
    const svc = new FormSubmissionsService(prisma, audit);
    const r = await svc.ingest(baseIngest());
    expect(r.duplicate).toBe(true);
  });

  it("rejects an oversized payload", async () => {
    const prisma = { websiteFormSubmission: { findUnique: async () => null } } as unknown as PrismaService;
    const svc = new FormSubmissionsService(prisma, audit);
    await expect(svc.ingest(baseIngest({ submittedData: { blob: "x".repeat(600 * 1024) } }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("FormSubmissionsService.update", () => {
  it("404s an unknown submission", async () => {
    const prisma = { websiteFormSubmission: { findUnique: async () => null } } as unknown as PrismaService;
    const svc = new FormSubmissionsService(prisma, audit);
    await expect(svc.update(user, "missing", { status: "RESOLVED" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a nonexistent related case", async () => {
    const prisma = {
      websiteFormSubmission: { findUnique: async () => ({ id: "sub-1", status: "NEW" }) },
      case: { findUnique: async () => null },
    } as unknown as PrismaService;
    const svc = new FormSubmissionsService(prisma, audit);
    await expect(
      svc.update(user, "sub-1", { relatedCaseId: "11111111-1111-1111-1111-111111111111" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stamps reviewer + time on a status change", async () => {
    let updateArg: { data: Record<string, unknown> } | null = null;
    const prisma = {
      websiteFormSubmission: {
        findUnique: async () => ({ id: "sub-1", status: "NEW" }),
        update: async (arg: { data: Record<string, unknown> }) => {
          updateArg = arg;
          return {
            id: "sub-1",
            reference: "HR-1",
            formKey: "hospital_referral",
            formName: "Hospital Referral",
            sourcePage: null,
            submitterName: null,
            submitterEmail: null,
            submitterPhone: null,
            submittedData: {},
            emailStatus: null,
            reportGenerated: false,
            documentGenerated: false,
            attachmentsCount: 0,
            status: "RESOLVED",
            reviewedByUserId: "user-1",
            reviewedAt: new Date("2026-08-29T00:00:00Z"),
            internalNotes: null,
            relatedCaseId: null,
            relatedProviderId: null,
            submittedAt: new Date("2026-08-29T00:00:00Z"),
            createdAt: new Date("2026-08-29T00:00:00Z"),
            updatedAt: new Date("2026-08-29T00:00:00Z"),
          };
        },
      },
      user: { findUnique: async () => ({ displayName: "Ops User", firstName: null, lastName: null, email: "o@x.com" }) },
    } as unknown as PrismaService;
    const svc = new FormSubmissionsService(prisma, audit);
    const r = await svc.update(user, "sub-1", { status: "RESOLVED" });
    expect(r.status).toBe("RESOLVED");
    expect(r.reviewedByName).toBe("Ops User");
    expect(updateArg!.data.reviewedByUserId).toBe("user-1");
    expect(updateArg!.data.reviewedAt).toBeInstanceOf(Date);
  });
});

describe("IngestTokenGuard", () => {
  function ctx(token?: string): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ headers: token ? { "x-ingest-token": token } : {} }) }),
    } as unknown as ExecutionContext;
  }
  const config = (value: string | undefined) =>
    ({ get: () => value }) as unknown as ConfigService<AppConfig, true>;

  it("throws when ingestion is not configured", () => {
    expect(() => new IngestTokenGuard(config(undefined)).canActivate(ctx("x"))).toThrow(ServiceUnavailableException);
  });

  it("rejects a wrong token", () => {
    expect(() => new IngestTokenGuard(config("secret")).canActivate(ctx("nope"))).toThrow(UnauthorizedException);
  });

  it("accepts the correct token", () => {
    expect(new IngestTokenGuard(config("secret")).canActivate(ctx("secret"))).toBe(true);
  });
});

describe("FormSubmissionsController access", () => {
  it("keeps ingest public and gates admin routes by permission", () => {
    const proto = FormSubmissionsController.prototype;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, proto.ingest)).toBe(true);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, proto.list)).toContain(PERMISSIONS.FORM_SUBMISSIONS_READ);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, proto.findOne)).toContain(PERMISSIONS.FORM_SUBMISSIONS_READ);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, proto.update)).toContain(PERMISSIONS.FORM_SUBMISSIONS_MANAGE);
  });
});
