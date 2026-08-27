import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { PrismaService } from "./database/prisma.service";

/**
 * End-to-end tests over the real Nest application with the database layer
 * mocked, so routing, validation, the response envelope and error handling are
 * all exercised without a live Postgres instance.
 */
describe("Platform API (e2e)", () => {
  let app: INestApplication;

  const prismaMock = {
    case: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (t: unknown) => unknown)(prismaMock),
    ),
    $disconnect: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
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

  it("GET /health returns a raw (unwrapped) liveness payload", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.data).toBeUndefined();
  });

  it("GET /api/v1/cases returns a wrapped, paginated result", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/cases");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });

  it("GET /api/v1/cases/:id rejects an invalid UUID with 400", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/cases/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("GET /api/v1/cases/:id returns 404 when the case is not found", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/cases/11111111-1111-4111-8111-111111111111");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("POST /api/v1/cases rejects an invalid body with 400", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/cases").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });
});
