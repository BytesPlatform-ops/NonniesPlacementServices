import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { AuthContextService } from "./auth-context.service";
import { IS_PUBLIC_KEY } from "./decorators";
import type { AuthState } from "./request-user";
import { TOKEN_VERIFIER, type TokenVerifier } from "./token-verifier";

const ORG_HEADER = "x-organization-id";

/**
 * Global authentication guard. Verifies the Supabase access token, resolves the
 * application user + active organization context, and attaches it to the
 * request. Authorization (permissions) is handled separately by PermissionsGuard.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly tokenVerifier: TokenVerifier,
    private readonly authContext: AuthContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & Partial<AuthState>>();

    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or malformed authorization header.");
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedException("Missing access token.");
    }

    const identity = await this.tokenVerifier.verify(token);
    if (!identity) {
      throw new UnauthorizedException("Invalid or expired access token.");
    }

    const requestedOrgRaw = request.headers[ORG_HEADER];
    const requestedOrg = Array.isArray(requestedOrgRaw) ? requestedOrgRaw[0] : requestedOrgRaw;

    // May throw ForbiddenException if the requested org is not an active membership.
    const authUser = await this.authContext.resolve(identity, requestedOrg ?? null);

    request.authIdentity = identity;
    request.authUser = authUser;
    return true;
  }
}
