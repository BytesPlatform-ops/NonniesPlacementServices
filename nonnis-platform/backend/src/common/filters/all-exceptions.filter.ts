import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import type { ApiError } from "../types/api-response";

/**
 * Centralized exception handling. Produces a consistent error envelope and maps
 * known Prisma errors to sensible HTTP statuses. Structured-logging-ready: all
 * unexpected errors are logged with context.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, details } = this.resolve(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiError = { error: { code, message, details }, statusCode: status };
    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        return { status, code: this.codeFor(status), message: res };
      }
      const obj = res as { message?: string | string[]; error?: string; details?: unknown };
      const message = Array.isArray(obj.message) ? obj.message.join("; ") : (obj.message ?? exception.message);
      return {
        status,
        code: this.codeFor(status),
        message,
        details: obj.details ?? (Array.isArray(obj.message) ? obj.message : undefined),
      };
    }

    // body-parser rejections (oversized or malformed request bodies). Without this
    // an over-limit provider webhook or import would surface as a 500.
    const parseError = exception as { type?: string; status?: number; statusCode?: number };
    if (parseError && typeof parseError.type === "string" && parseError.type.startsWith("entity.")) {
      if (parseError.type === "entity.too.large") {
        return { status: HttpStatus.PAYLOAD_TOO_LARGE, code: "PAYLOAD_TOO_LARGE", message: "The request body is too large." };
      }
      return { status: HttpStatus.BAD_REQUEST, code: "INVALID_BODY", message: "The request body could not be parsed." };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case "P2025":
          return { status: HttpStatus.NOT_FOUND, code: "NOT_FOUND", message: "Resource not found." };
        case "P2002":
          return { status: HttpStatus.CONFLICT, code: "CONFLICT", message: "A record with these values already exists." };
        case "P2003":
          return { status: HttpStatus.BAD_REQUEST, code: "INVALID_REFERENCE", message: "A referenced record does not exist." };
        default:
          return { status: HttpStatus.BAD_REQUEST, code: "DATABASE_ERROR", message: "Database request failed." };
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { status: HttpStatus.BAD_REQUEST, code: "DATABASE_VALIDATION_ERROR", message: "Invalid database query." };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    };
  }

  private codeFor(status: number): string {
    const map: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "UNPROCESSABLE_ENTITY",
    };
    return map[status] ?? "ERROR";
  }
}
