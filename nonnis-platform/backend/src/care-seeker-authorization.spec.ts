import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { PrismaService } from "./database/prisma.service";
import { TOKEN_VERIFIER, type VerifiedIdentity } from "./modules/auth/token-verifier";
import { PERMISSIONS, ROLE_DEFINITIONS, ROLES } from "./common/rbac";

/**
 * Cross-role authorization over the real Nest application.
 *
 * This is the security proof for the family portal: it drives actual HTTP
 * requests through the real guards, the real controllers and the real
 * permission metadata, with only Supabase token verification and the database
 * mocked. Every assertion is a status code a browser would receive.
 *
 * It covers both directions — a family member cannot reach staff or provider
 * surfaces, and staff and provider users cannot reach the family portal — plus
 * the cross-case rule, which is the one that matters most.
 */

const CASE_A = "11111111-1111-4111-8111-111111111111";
const CASE_B = "22222222-2222-4222-8222-222222222222";
const REFERRAL_A = "33333333-3333-4333-8333-333333333333";
const REFERRAL_B = "44444444-4444-4444-8444-444444444444";
const DOC_A = "55555555-5555-4555-8555-555555555555";

const ORG_NONNIS = "aaaaaaaa-0000-4000-8000-000000000001";
const ORG_HOSPITAL = "aaaaaaaa-0000-4000-8000-000000000002";
const ORG_PROVIDER = "aaaaaaaa-0000-4000-8000-000000000003";

function membership(organizationId: string, organizationType: string, roleCode: keyof typeof ROLE_DEFINITIONS) {
  return {
    id: `mem-${roleCode}`,
    organizationId,
    status: "ACTIVE",
    isPrimary: true,
    roleId: `role-${roleCode}`,
    organization: { name: organizationType, type: organizationType, status: "ACTIVE" },
    role: {
      code: roleCode,
      name: roleCode,
      permissions: ROLE_DEFINITIONS[roleCode].permissions.map((code) => ({ permission: { code } })),
    },
  };
}

function seekerGrant(caseId: string) {
  return {
    id: `acc-${caseId}`,
    caseId,
    status: "ACTIVE",
    relationship: "Daughter",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    case: { caseNumber: `CASE-${caseId.slice(0, 4)}`, status: "MATCHING", patient: { firstName: "Rose", lastName: "Miller" } },
    role: {
      code: ROLES.CARE_SEEKER,
      name: "Care Seeker",
      permissions: ROLE_DEFINITIONS[ROLES.CARE_SEEKER].permissions.map((code) => ({ permission: { code } })),
    },
  };
}

/** The five identities under test, keyed by the bearer token used to reach them. */
const USERS: Record<string, { id: string; memberships: unknown[]; careSeekerAccess: unknown[] }> = {
  "nonnis-admin": {
    id: "u-nonnis",
    memberships: [membership(ORG_NONNIS, "NONNIS", ROLES.NONNIS_ADMIN)],
    careSeekerAccess: [],
  },
  discharge: {
    id: "u-discharge",
    memberships: [membership(ORG_HOSPITAL, "HOSPITAL", ROLES.DISCHARGE_PROFESSIONAL)],
    careSeekerAccess: [],
  },
  "provider-admin": {
    id: "u-provider",
    memberships: [membership(ORG_PROVIDER, "PROVIDER", ROLES.PROVIDER_ADMIN)],
    careSeekerAccess: [],
  },
  "provider-staff": {
    id: "u-provider-staff",
    memberships: [membership(ORG_PROVIDER, "PROVIDER", ROLES.PROVIDER_STAFF)],
    careSeekerAccess: [],
  },
  "seeker-a": { id: "u-seeker-a", memberships: [], careSeekerAccess: [seekerGrant(CASE_A)] },
  "seeker-b": { id: "u-seeker-b", memberships: [], careSeekerAccess: [seekerGrant(CASE_B)] },
};

const emptyCase = {
  id: CASE_A,
  caseNumber: "CASE-1111",
  status: "MATCHING",
  organizationId: ORG_HOSPITAL,
  assignedDischargeProfessionalId: null,
  currentCareSetting: null,
  preferredServiceLocation: null,
  primaryLanguage: null,
  interpreterRequired: false,
  communicationPreference: null,
  accessibilityNeeds: [],
  expectedDischargeDate: null,
  patient: { firstName: "Rose", lastName: "Miller", dateOfBirth: null },
  serviceRequests: [],
  requirements: [],
  referrals: [],
  appointments: [],
};

describe("Care Seeker authorization (e2e)", () => {
  let app: INestApplication;

  const tokenVerifierMock = {
    verify: async (token: string): Promise<VerifiedIdentity | null> =>
      USERS[token] ? { supabaseUserId: `sb-${token}`, email: `${token}@example.test` } : null,
  };

  const prismaMock = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { supabaseAuthUserId?: string; id?: string } }) => {
        if (where.supabaseAuthUserId) {
          const token = where.supabaseAuthUserId.replace(/^sb-/, "");
          const u = USERS[token];
          if (!u) return Promise.resolve(null);
          return Promise.resolve({
            id: u.id,
            email: `${token}@example.test`,
            firstName: null,
            lastName: null,
            displayName: null,
            status: "ACTIVE",
            supabaseAuthUserId: where.supabaseAuthUserId,
            memberships: u.memberships,
            careSeekerAccess: u.careSeekerAccess,
          });
        }
        return Promise.resolve({ displayName: null, firstName: null, lastName: null });
      }),
    },
    case: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === CASE_A || where.id === CASE_B ? { ...emptyCase, id: where.id } : null),
      ),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ organizationId: ORG_HOSPITAL }),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    referral: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === REFERRAL_A) return Promise.resolve({ caseId: CASE_A, providerId: "p1", status: "SENT", case: { organizationId: ORG_HOSPITAL }, provider: { organizationId: ORG_PROVIDER } });
        if (where.id === REFERRAL_B) return Promise.resolve({ caseId: CASE_B, providerId: "p2", status: "SENT", case: { organizationId: ORG_HOSPITAL }, provider: { organizationId: ORG_PROVIDER } });
        return Promise.resolve(null);
      }),
    },
    workflowEvent: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    caseDocument: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    caseAppointment: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    careSeekerCaseAccess: { findMany: jest.fn().mockResolvedValue([]) },
    provider: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
    message: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation((arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : (arg as (t: unknown) => unknown)(prismaMock))),
    $disconnect: jest.fn(),
  };

  const as = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(TOKEN_VERIFIER)
      .useValue(tokenVerifierMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1", { exclude: ["health"] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------------
  // A family member reaches their own case
  // -------------------------------------------------------------------------

  describe("a care seeker on their own case", () => {
    it("signs in and is recognized as case-scoped, with no organization", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/auth/me").set("Authorization", as("seeker-a"));
      expect(res.status).toBe(200);
      expect(res.body.data.memberships).toEqual([]);
      expect(res.body.data.activeOrganizationId).toBeNull();
      expect(res.body.data.caseAccess).toHaveLength(1);
      expect(res.body.data.caseAccess[0].caseId).toBe(CASE_A);
      expect(res.body.data.permissions).toContain(PERMISSIONS.SEEKER_CASE_READ);
    });

    it("opens their dashboard", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/seeker/dashboard").set("Authorization", as("seeker-a"));
      expect(res.status).toBe(200);
      expect(res.body.data.caseId).toBe(CASE_A);
      expect(res.body.data.careRecipientName).toBe("Rose Miller");
    });

    it.each([
      ["/api/v1/seeker/cases", "cases"],
      ["/api/v1/seeker/care-plan", "care plan"],
      ["/api/v1/seeker/matches", "matches"],
      ["/api/v1/seeker/progress", "progress"],
      ["/api/v1/seeker/documents", "documents"],
      ["/api/v1/seeker/appointments", "appointments"],
      ["/api/v1/seeker/messages", "messages"],
      ["/api/v1/seeker/account", "account"],
    ])("reaches %s", async (path) => {
      const res = await request(app.getHttpServer()).get(path).set("Authorization", as("seeker-a"));
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // The cross-case rule
  // -------------------------------------------------------------------------

  describe("cross-case isolation", () => {
    it("Seeker A cannot open Case B — 404, not 403", async () => {
      // 404 on purpose: a 403 would confirm that Case B exists.
      for (const path of ["dashboard", "care-plan", "matches", "progress", "documents", "appointments", "messages"]) {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/seeker/${path}?caseId=${CASE_B}`)
          .set("Authorization", as("seeker-a"));
        expect(res.status).toBe(404);
      }
    });

    it("Seeker B cannot open Case A either", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/seeker/dashboard?caseId=${CASE_A}`)
        .set("Authorization", as("seeker-b"));
      expect(res.status).toBe(404);
    });

    it("Seeker A cannot open a referral raised on Case B", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/seeker/matches/${REFERRAL_B}`)
        .set("Authorization", as("seeker-a"));
      expect(res.status).toBe(404);
    });

    it("Seeker A cannot post a message onto Case B", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/seeker/messages")
        .set("Authorization", as("seeker-a"))
        .send({ body: "Trying another case", caseId: CASE_B });
      expect(res.status).toBe(404);
    });

    it("Seeker A cannot upload a document against Case B", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/seeker/documents/${DOC_A}/upload`)
        .set("Authorization", as("seeker-a"))
        .send({ fileName: "x.pdf", contentType: "application/pdf", contentBase64: "AAAA", caseId: CASE_B });
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // A family member cannot reach staff or provider surfaces
  // -------------------------------------------------------------------------

  describe("a care seeker is refused every staff and provider surface", () => {
    it.each([
      "/api/v1/cases",
      "/api/v1/operations/summary",
      "/api/v1/providers",
      "/api/v1/provider-portal/me",
      "/api/v1/users",
      "/api/v1/organizations",
      "/api/v1/reports/overview",
      "/api/v1/communications/contacts",
      "/api/v1/tasks",
    ])("cannot GET %s", async (path) => {
      const res = await request(app.getHttpServer()).get(path).set("Authorization", as("seeker-a"));
      expect(res.status).toBe(403);
    });

    it("cannot read the staff case record even for their own case", async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/cases/${CASE_A}`).set("Authorization", as("seeker-a"));
      expect(res.status).toBe(403);
    });

    it("cannot read internal notes on their own case", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cases/${CASE_A}/internal-notes`)
        .set("Authorization", as("seeker-a"));
      expect(res.status).toBe(403);
    });

    it("cannot read the staff timeline for their own case", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cases/${CASE_A}/timeline`)
        .set("Authorization", as("seeker-a"));
      expect(res.status).toBe(403);
    });

    it("cannot grant themselves or anyone else access to a case", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cases/${CASE_A}/care-seekers`)
        .set("Authorization", as("seeker-a"))
        .send({ email: "someone@example.test" });
      expect(res.status).toBe(403);
    });

    it("cannot schedule or complete an appointment like staff can", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cases/${CASE_A}/appointments`)
        .set("Authorization", as("seeker-a"))
        .send({ type: "TOUR", scheduledAt: new Date().toISOString() });
      expect(res.status).toBe(403);
    });

    it("cannot review a document like staff can", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/cases/${CASE_A}/documents/${DOC_A}/review`)
        .set("Authorization", as("seeker-a"))
        .send({ status: "ACCEPTED" });
      expect(res.status).toBe(403);
    });

    it("cannot forge organization context to widen its own access", async () => {
      // The header names an organization this user has no membership in.
      const res = await request(app.getHttpServer())
        .get("/api/v1/seeker/dashboard")
        .set("Authorization", as("seeker-a"))
        .set("X-Organization-Id", ORG_NONNIS);
      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Staff and provider users cannot reach the family portal
  // -------------------------------------------------------------------------

  describe("the family portal is closed to every organization role", () => {
    it.each(["discharge", "provider-admin", "provider-staff"])(
      "%s is refused by the permission guard",
      async (token) => {
        // None of these roles holds a `seeker_*` permission, so the guard stops
        // them before any handler runs.
        for (const path of ["dashboard", "care-plan", "matches", "documents", "appointments", "messages", "cases"]) {
          const res = await request(app.getHttpServer())
            .get(`/api/v1/seeker/${path}`)
            .set("Authorization", as(token));
          expect(res.status).toBe(403);
        }
      },
    );

    it("refuses a Nonnis administrator too, by the absence of a case grant", async () => {
      // NONNIS_ADMIN receives every permission by definition, including the
      // `seeker_*` codes, so the permission guard cannot be what stops them.
      // The second gate does: they hold no CareSeekerCaseAccess row, so there is
      // no case to open and nothing is served.
      for (const path of ["dashboard", "care-plan", "matches", "documents", "appointments", "messages"]) {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/seeker/${path}`)
          .set("Authorization", as("nonnis-admin"));
        expect(res.status).toBe(404);
      }
      // Asking for a specific case is refused just as firmly.
      const targeted = await request(app.getHttpServer())
        .get(`/api/v1/seeker/dashboard?caseId=${CASE_A}`)
        .set("Authorization", as("nonnis-admin"));
      expect(targeted.status).toBe(404);

      // And their own case list is empty rather than every case on the platform.
      const cases = await request(app.getHttpServer()).get("/api/v1/seeker/cases").set("Authorization", as("nonnis-admin"));
      expect(cases.status).toBe(200);
      expect(cases.body.data).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Existing roles keep working
  // -------------------------------------------------------------------------

  describe("existing roles are unchanged", () => {
    it("a Nonnis administrator still reaches the staff surfaces", async () => {
      for (const path of ["/api/v1/cases", "/api/v1/providers", "/api/v1/users", "/api/v1/organizations"]) {
        const res = await request(app.getHttpServer()).get(path).set("Authorization", as("nonnis-admin"));
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      }
    });

    it("a discharge professional still reaches cases and is still refused platform admin", async () => {
      const cases = await request(app.getHttpServer()).get("/api/v1/cases").set("Authorization", as("discharge"));
      expect(cases.status).not.toBe(403);

      const orgs = await request(app.getHttpServer()).get("/api/v1/organizations").set("Authorization", as("discharge"));
      expect(orgs.status).not.toBe(401);

      const users = await request(app.getHttpServer()).get("/api/v1/users").set("Authorization", as("discharge"));
      expect(users.status).toBe(403);
    });

    it("a provider admin still reaches the provider portal and is still refused cases", async () => {
      const portal = await request(app.getHttpServer())
        .get("/api/v1/provider-portal/me")
        .set("Authorization", as("provider-admin"));
      expect(portal.status).not.toBe(403);

      const cases = await request(app.getHttpServer()).get("/api/v1/cases").set("Authorization", as("provider-admin"));
      expect(cases.status).toBe(403);
    });

    it("provider staff keep exactly their previous reach", async () => {
      const providers = await request(app.getHttpServer()).get("/api/v1/providers").set("Authorization", as("provider-staff"));
      expect(providers.status).not.toBe(403);

      for (const denied of ["/api/v1/users", "/api/v1/cases", "/api/v1/operations/summary"]) {
        const res = await request(app.getHttpServer()).get(denied).set("Authorization", as("provider-staff"));
        expect(res.status).toBe(403);
      }
    });

    it("keeps the public website APIs public", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/public/residential-providers");
      expect(res.status).toBe(200);
    });
  });
});
