import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { AppConfig } from "../../config/configuration";

/**
 * Server-to-server guard for the website form-ingestion endpoint. The public
 * website's server-side handler sends a shared secret in `X-Ingest-Token`; the
 * token is a backend-only env value and is never exposed to the browser.
 */
@Injectable()
export class IngestTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get("formIngestToken", { infer: true });
    if (!expected) {
      throw new ServiceUnavailableException("Form ingestion is not configured.");
    }
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers["x-ingest-token"];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided || provided !== expected) {
      throw new UnauthorizedException("Invalid ingestion token.");
    }
    return true;
  }
}
