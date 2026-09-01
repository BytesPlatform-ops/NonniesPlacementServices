import { ConflictException, UnprocessableEntityException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { MediaService } from "../content/media.service";
import type { ProviderAccessService } from "./provider-access";
import { ProvidersService } from "./providers.service";
import type { RequestUser } from "../auth/request-user";

const user = { id: "u1" } as RequestUser;

function build(prismaProvider: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const prisma = { provider: prismaProvider, providerService: extra.providerService ?? { count: jest.fn() } } as unknown as PrismaService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const access = { loadForWrite: jest.fn().mockResolvedValue({ id: "p1", organizationId: "o1", status: "ACTIVE" }) } as unknown as ProviderAccessService;
  const media = { deleteObject: jest.fn().mockResolvedValue(undefined) } as unknown as MediaService;
  const svc = new ProvidersService(prisma, audit, access, media);
  jest.spyOn(svc, "findOne").mockResolvedValue({ id: "p1" } as never);
  return { svc, audit, media };
}

describe("ProvidersService.publish", () => {
  it("rejects with structured missing fields when the profile is incomplete", async () => {
    const update = jest.fn();
    const { svc } = build(
      {
        findUnique: jest.fn().mockResolvedValue({
          isResidentialProvider: false,
          status: "ACTIVE",
          displayName: "Sunrise",
          publicSlug: null,
          city: null,
          state: null,
        }),
        update,
      },
      { providerService: { count: jest.fn().mockResolvedValue(0) } },
    );
    await expect(svc.publish(user, "p1")).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(update).not.toHaveBeenCalled();
  });

  it("publishes and audits when the profile is complete", async () => {
    const update = jest.fn().mockResolvedValue({});
    const { svc, audit } = build(
      {
        findUnique: jest.fn().mockResolvedValue({
          isResidentialProvider: true,
          status: "ACTIVE",
          displayName: "Sunrise",
          publicSlug: "sunrise",
          city: "Sacramento",
          state: "CA",
        }),
        update,
      },
      { providerService: { count: jest.fn().mockResolvedValue(2) } },
    );
    await svc.publish(user, "p1");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ publicListingEnabled: true }) }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "provider.published" }));
  });
});

describe("ProvidersService.unpublish", () => {
  it("disables the listing and audits", async () => {
    const update = jest.fn().mockResolvedValue({});
    const { svc, audit } = build({ update });
    await svc.unpublish(user, "p1");
    expect(update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { publicListingEnabled: false } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "provider.unpublished" }));
  });
});

describe("ProvidersService.updatePublicListing", () => {
  it("rejects a slug already used by another provider", async () => {
    const { svc } = build({
      findFirst: jest.fn().mockResolvedValue({ id: "other" }),
      findUnique: jest.fn().mockResolvedValue({ publicFeaturedImageStoragePath: null }),
      update: jest.fn(),
    });
    await expect(svc.updatePublicListing(user, "p1", { publicSlug: "taken" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("deletes a replaced managed image after saving", async () => {
    const { svc, media } = build({
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({ publicFeaturedImageStoragePath: "providers/public/old.jpg" }),
      update: jest.fn().mockResolvedValue({}),
    });
    await svc.updatePublicListing(user, "p1", { publicFeaturedImageStoragePath: "providers/public/new.jpg" });
    expect(media.deleteObject).toHaveBeenCalledWith("providers/public/old.jpg");
  });
});
