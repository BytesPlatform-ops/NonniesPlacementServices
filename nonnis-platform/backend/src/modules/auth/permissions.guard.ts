import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ANY_PERMISSIONS_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY } from "./decorators";
import type { AuthState } from "./request-user";

/**
 * Global authorization guard. Enforces the permission codes declared via
 * @RequirePermissions against the authenticated user's active-organization
 * permissions. Runs after AuthGuard.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const anyOf = this.reflector.getAllAndOverride<string[]>(ANY_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const hasRequired = required && required.length > 0;
    const hasAnyOf = anyOf && anyOf.length > 0;
    if (!hasRequired && !hasAnyOf) return true;

    const request = context.switchToHttp().getRequest<Partial<AuthState>>();
    const user = request.authUser;
    if (!user) {
      throw new ForbiddenException("You do not have access to this resource.");
    }

    const missingAll = hasRequired ? required.filter((p) => !user.activePermissions.has(p)) : [];
    const satisfiesAny = hasAnyOf ? anyOf.some((p) => user.activePermissions.has(p)) : true;
    if (missingAll.length > 0 || !satisfiesAny) {
      throw new ForbiddenException("You do not have permission to perform this action.");
    }
    return true;
  }
}
