import { BadRequestException, HttpStatus, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ArgumentsHost } from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter";

interface Captured {
  status: number;
  body: { error: { code: string; message: string; details?: unknown }; statusCode: number };
}

function run(exception: unknown): { captured: Captured; logged: jest.SpyInstance } {
  const captured = {} as Captured;
  const res = {
    status(s: number) {
      captured.status = s;
      return this;
    },
    json(b: Captured["body"]) {
      captured.body = b;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ method: "GET", url: "/api/v1/seeker/messages?pageSize=100" }),
    }),
  } as unknown as ArgumentsHost;

  const logged = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  new AllExceptionsFilter().catch(exception, host);
  return { captured, logged };
}

afterEach(() => jest.restoreAllMocks());

describe("AllExceptionsFilter — a malformed query is our bug, not the caller's", () => {
  const malformed = () => new Prisma.PrismaClientValidationError("Argument `take`: Invalid value provided.", { clientVersion: "6" });

  it("answers 500, because the request was valid and our query was not", () => {
    // A 400 here sends every investigation after the client's input, which was fine.
    const { captured } = run(malformed());
    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it("says plainly that the fault is in the API", () => {
    const { captured } = run(malformed());
    expect(captured.body.error.message).toContain("bug in the API");
    expect(captured.body.error.code).toBe("DATABASE_VALIDATION_ERROR");
  });

  it("logs it with the route, which the old 5xx-only rule never did", () => {
    const { logged } = run(malformed());
    expect(logged).toHaveBeenCalled();
    expect(String(logged.mock.calls[0]![0])).toContain("/api/v1/seeker/messages");
  });

  it("hands a developer the underlying reason outside production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      expect(String(run(malformed()).captured.body.error.details)).toContain("take");
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("withholds that reason in production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(run(malformed()).captured.body.error.details).toBeUndefined();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

describe("AllExceptionsFilter — deliberate errors stay quiet and unchanged", () => {
  it("passes a 404 through without logging it as a defect", () => {
    const { captured, logged } = run(new NotFoundException("Conversation not found"));
    expect(captured.status).toBe(HttpStatus.NOT_FOUND);
    expect(captured.body.error.message).toBe("Conversation not found");
    expect(logged).not.toHaveBeenCalled();
  });

  it("passes a validation 400 through without logging it as a defect", () => {
    const { captured, logged } = run(new BadRequestException("Enter a valid mobile number."));
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(logged).not.toHaveBeenCalled();
  });

  it("logs a plain unexpected error", () => {
    const { captured, logged } = run(new Error("boom"));
    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(logged).toHaveBeenCalled();
  });
});
