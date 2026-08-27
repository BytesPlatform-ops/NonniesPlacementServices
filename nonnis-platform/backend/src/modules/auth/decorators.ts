import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { AuthState, RequestUser } from "./request-user";

/** Marks a route as public (no authentication required), e.g. health checks. */
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Declares the permission codes required to invoke a handler. */
export const PERMISSIONS_KEY = "requiredPermissions";
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/** Injects the authenticated application user (present on permission-guarded routes). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest<Partial<AuthState>>();
  return request.authUser as RequestUser;
});

/** Injects the full auth state, including identity when the user is unprovisioned. */
export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthState => {
  const request = ctx.switchToHttp().getRequest<AuthState>();
  return { authIdentity: request.authIdentity, authUser: request.authUser };
});
