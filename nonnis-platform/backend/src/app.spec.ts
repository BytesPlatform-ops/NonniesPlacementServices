import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { PrismaService } from "./database/prisma.service";
import { TOKEN_VERIFIER, type VerifiedIdentity } from "./modules/auth/token-verifier";

/**
 * HTTP-level auth behavior over the real Nest application, with Supabase token
 * verification and the database layer mocked. Deeper authorization/isolation
 * logic is covered by service/guard unit tests.
 */
describe("Platform API (e2e)", () => {
  let app: INestApplication;

  const tokenVerifierMock = {
    verify: async (token: string): Promise<VerifiedIdentity | null> =>
      token === "valid" ? { supabaseUserId: "sb-x", email: "x@example.com" } : null,
  };

  // Unprovisioned identity: no application user exists for the verified identity.
  const prismaMock = {
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    $disconnect: jest.fn(),
  };

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

  it("GET /health is public and returns a raw liveness payload", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.data).toBeUndefined();
  });

  it("rejects a protected route with no token (401)", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/cases");
    expect(res.status).toBe(401);
  });

  it("rejects a protected route with an invalid token (401)", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/cases").set("Authorization", "Bearer nope");
    expect(res.status).toBe(401);
  });

  it("denies a valid but unprovisioned identity from protected data (403)", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/cases").set("Authorization", "Bearer valid");
    expect(res.status).toBe(403);
  });

  it("GET /api/v1/auth/me returns an unprovisioned context for a new identity", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/auth/me").set("Authorization", "Bearer valid");
    expect(res.status).toBe(200);
    expect(res.body.data.authenticated).toBe(true);
    expect(res.body.data.provisioned).toBe(false);
    expect(res.body.data.memberships).toEqual([]);
  });
});
