import { Prisma } from "@prisma/client";
import { isTransientInfrastructureError } from "./transient-error";

const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: "6.0.0" });

describe("isTransientInfrastructureError", () => {
  it("treats a connection-pool timeout as transient", () => {
    // P2024 is what a serverless deployment hits under concurrency: each
    // instance opens its own pool, so a request can time out waiting for a
    // connection while the data itself is perfectly fine.
    expect(isTransientInfrastructureError(known("P2024"))).toBe(true);
  });

  it("treats unreachable/closed database connections as transient", () => {
    for (const code of ["P1001", "P1002", "P1008", "P1017", "P2028"]) {
      expect(isTransientInfrastructureError(known(code))).toBe(true);
    }
  });

  it("recognises pool exhaustion reported as a plain error", () => {
    expect(isTransientInfrastructureError(new Error("Timed out fetching a new connection from the connection pool"))).toBe(true);
    expect(isTransientInfrastructureError(new Error("socket hang up"))).toBe(true);
    expect(isTransientInfrastructureError(new Error("connect ECONNREFUSED 10.0.0.1:5432"))).toBe(true);
  });

  it("does NOT treat a data error as transient", () => {
    // Retrying a unique-constraint violation or a bad payload changes nothing,
    // so these must be acknowledged rather than retried forever.
    expect(isTransientInfrastructureError(known("P2002"))).toBe(false);
    expect(isTransientInfrastructureError(known("P2025"))).toBe(false);
    expect(isTransientInfrastructureError(new Error("Unexpected token < in JSON"))).toBe(false);
    expect(isTransientInfrastructureError(new TypeError("x is not a function"))).toBe(false);
  });

  it("handles non-Error values without throwing", () => {
    for (const value of [undefined, null, "boom", 42, {}]) {
      expect(isTransientInfrastructureError(value)).toBe(false);
    }
  });
});
