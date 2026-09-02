import "reflect-metadata";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "./app.module";
import { PrismaService } from "./database/prisma.service";
import { TOKEN_VERIFIER } from "./modules/auth/token-verifier";
import { ANY_PERMISSIONS_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY } from "./modules/auth/decorators";

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "ALL", "OPTIONS", "HEAD", "SEARCH"];

/**
 * Routes that are deliberately reachable WITHOUT authentication. Every entry is a
 * conscious decision: infrastructure health, the public marketing website's read-only
 * APIs, the public unsubscribe page, the server-to-server website form ingest (guarded
 * by its own shared token), and provider webhooks (guarded by signature/secret).
 *
 * Adding a route here must be a deliberate act — the test below fails for anything
 * public that is not on this list.
 */
const INTENTIONALLY_PUBLIC = new Set([
  "GET /health",
  "GET /public/blog",
  "GET /public/blog/:slug",
  "GET /public/blog-videos",
  "GET /public/testimonials",
  "GET /public/residential-providers",
  "GET /public/residential-providers/options",
  "GET /public/residential-providers/:slug",
  "GET /public/communications/unsubscribe",
  "POST /public/communications/unsubscribe",
  "POST /form-submissions/ingest",
  "POST /communications/email/webhook",
  "POST /webhooks/communications/email/inbound",
  "POST /webhooks/communications/sms/inbound",
  "POST /webhooks/communications/sms/status",
]);

/**
 * Routes that require authentication but intentionally no specific permission,
 * because they only ever return the caller's OWN identity/context.
 */
const INTENTIONALLY_AUTH_ONLY = new Set(["GET /auth/me"]);

interface RouteInfo {
  key: string;
  controller: string;
  handler: string;
  policy: "PUBLIC" | "AUTH-ONLY" | "GATED";
}

function collectRoutes(app: INestApplication): RouteInfo[] {
  const container = (app as unknown as {
    container: { getModules: () => Map<string, { controllers: Map<unknown, { metatype?: new (...a: never[]) => object }> }> };
  }).container;
  const routes: RouteInfo[] = [];

  for (const mod of container.getModules().values()) {
    for (const wrapper of mod.controllers.values()) {
      const ctrl = wrapper.metatype;
      if (!ctrl) continue;
      const basePaths: string[] = ([] as string[]).concat(Reflect.getMetadata(PATH_METADATA, ctrl) ?? "/");
      const proto = ctrl.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === "constructor") continue;
        const fn = proto[name];
        if (typeof fn !== "function") continue;
        const routePath = Reflect.getMetadata(PATH_METADATA, fn as object);
        if (routePath === undefined) continue;

        const method = METHODS[Reflect.getMetadata(METHOD_METADATA, fn as object) as number] ?? "GET";
        const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, fn as object) === true || Reflect.getMetadata(IS_PUBLIC_KEY, ctrl) === true;
        const required: string[] = Reflect.getMetadata(PERMISSIONS_KEY, fn as object) ?? Reflect.getMetadata(PERMISSIONS_KEY, ctrl) ?? [];
        const anyOf: string[] = Reflect.getMetadata(ANY_PERMISSIONS_KEY, fn as object) ?? Reflect.getMetadata(ANY_PERMISSIONS_KEY, ctrl) ?? [];

        for (const base of basePaths) {
          const path = `/${base}/${routePath}`.replace(/\/+/g, "/").replace(/(.)\/$/, "$1");
          routes.push({
            key: `${method} ${path}`,
            controller: ctrl.name,
            handler: name,
            policy: isPublic ? "PUBLIC" : required.length || anyOf.length ? "GATED" : "AUTH-ONLY",
          });
        }
      }
    }
  }
  return routes;
}

/**
 * Whole-backend structural authorization guarantee. Navigation hiding is not security,
 * and neither is reviewer memory: this walks EVERY registered route and fails if one is
 * reachable without a deliberate, listed policy. A new endpoint cannot ship unprotected
 * by accident.
 */
describe("backend route authorization", () => {
  let app: INestApplication;
  let routes: RouteInfo[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn(), $on: jest.fn() })
      .overrideProvider(TOKEN_VERIFIER)
      .useValue({ verify: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    routes = collectRoutes(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("discovers the full route table", () => {
    expect(routes.length).toBeGreaterThan(200);
  });

  it("exposes no public route that is not explicitly allow-listed", () => {
    const unexpected = routes.filter((r) => r.policy === "PUBLIC" && !INTENTIONALLY_PUBLIC.has(r.key));
    expect(unexpected.map((r) => `${r.key} (${r.controller}.${r.handler})`)).toEqual([]);
  });

  it("leaves no route authenticated-but-ungated except the caller's own context", () => {
    const ungated = routes.filter((r) => r.policy === "AUTH-ONLY" && !INTENTIONALLY_AUTH_ONLY.has(r.key));
    expect(ungated.map((r) => `${r.key} (${r.controller}.${r.handler})`)).toEqual([]);
  });

  it("keeps every allow-listed public route actually present (the list cannot rot)", () => {
    const publicKeys = new Set(routes.filter((r) => r.policy === "PUBLIC").map((r) => r.key));
    const stale = [...INTENTIONALLY_PUBLIC].filter((k) => !publicKeys.has(k));
    expect(stale).toEqual([]);
  });
});
