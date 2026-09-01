import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../database/prisma.service";
import { PublicProvidersService } from "./public-providers.service";
import type { PublicProviderListDto } from "./dto/public-provider.dto";

const PUBLISHED_GATE = { status: "ACTIVE", isResidentialProvider: true, publicListingEnabled: true };

function makePrisma(overrides: Record<string, unknown> = {}) {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const findFirst = jest.fn().mockResolvedValue(null);
  const prisma = {
    $transaction: (arr: Promise<unknown>[]) => Promise.all(arr),
    provider: { findMany, count, findFirst, ...overrides },
  } as unknown as PrismaService;
  return { prisma, findMany, count, findFirst };
}

const baseQuery = (over: Partial<PublicProviderListDto> = {}): PublicProviderListDto =>
  ({ page: 1, limit: 12, ...over }) as PublicProviderListDto;

describe("PublicProvidersService.list — published-only gate", () => {
  it("always constrains to ACTIVE + residential + published", async () => {
    const { prisma, findMany } = makePrisma();
    await new PublicProvidersService(prisma).list(baseQuery());
    const where = findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual(PUBLISHED_GATE);
  });

  it("adds a service-category filter when provided", async () => {
    const { prisma, findMany } = makePrisma();
    await new PublicProvidersService(prisma).list(baseQuery({ serviceCategory: "cat-1" }));
    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ services: { some: { serviceCategoryId: "cat-1", active: true } } });
  });

  it("adds language and payment filters when provided", async () => {
    const { prisma, findMany } = makePrisma();
    await new PublicProvidersService(prisma).list(baseQuery({ language: "lang-1", paymentType: "pay-1" }));
    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ languages: { some: { languageId: "lang-1", active: true } } });
    expect(where.AND).toContainEqual({ paymentTypes: { some: { paymentTypeId: "pay-1", active: true } } });
  });

  it("paginates with the requested limit", async () => {
    const { prisma, findMany } = makePrisma();
    await new PublicProvidersService(prisma).list(baseQuery({ page: 2, limit: 6 }));
    const args = findMany.mock.calls[0][0];
    expect(args.skip).toBe(6);
    expect(args.take).toBe(6);
  });
});

describe("PublicProvidersService.findBySlug", () => {
  it("404s when no published provider matches the slug", async () => {
    const { prisma } = makePrisma();
    await expect(new PublicProvidersService(prisma).findBySlug("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("applies the published gate to the slug lookup", async () => {
    const { prisma, findFirst } = makePrisma();
    await new PublicProvidersService(prisma).findBySlug("missing").catch(() => undefined);
    const where = findFirst.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual(PUBLISHED_GATE);
    expect(where.AND[1]).toEqual({ publicSlug: "missing" });
  });
});

describe("PublicProvidersService.options", () => {
  it("aggregates distinct, sorted values from published providers only", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        state: "CA",
        services: [{ serviceCategory: { id: "c2", name: "Skilled Nursing" } }, { serviceCategory: { id: "c1", name: "Assisted Living" } }],
        languages: [{ language: { id: "l1", name: "Spanish" } }],
        paymentTypes: [{ paymentType: { id: "p1", name: "Medicaid" } }],
      },
      {
        state: "CA",
        services: [{ serviceCategory: { id: "c1", name: "Assisted Living" } }],
        languages: [{ language: { id: "l1", name: "Spanish" } }],
        paymentTypes: [],
      },
    ]);
    const prisma = { provider: { findMany } } as unknown as PrismaService;
    const opts = await new PublicProvidersService(prisma).options();
    // Published gate applied.
    expect(findMany.mock.calls[0][0].where).toEqual(PUBLISHED_GATE);
    // Distinct + alphabetical.
    expect(opts.serviceCategories).toEqual([
      { id: "c1", name: "Assisted Living" },
      { id: "c2", name: "Skilled Nursing" },
    ]);
    expect(opts.languages).toEqual([{ id: "l1", name: "Spanish" }]);
    expect(opts.paymentTypes).toEqual([{ id: "p1", name: "Medicaid" }]);
    expect(opts.states).toEqual(["CA"]);
  });
});
