import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";
import { ANY_PERMISSIONS_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY } from "./decorators";
import type { RequestUser } from "./request-user";

function contextFor(authUser: RequestUser | null): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ authUser }) }),
  } as unknown as ExecutionContext;
}

function reflectorWith(values: { public?: boolean; required?: string[]; anyOf?: string[] }): Reflector {
  return {
    getAllAndOverride: (key: string) => {
      if (key === IS_PUBLIC_KEY) return values.public ?? false;
      if (key === PERMISSIONS_KEY) return values.required;
      if (key === ANY_PERMISSIONS_KEY) return values.anyOf;
      return undefined;
    },
  } as unknown as Reflector;
}

function user(permissions: string[]): RequestUser {
  return {
    id: "u",
    supabaseUserId: "s",
    email: "e@x.com",
    firstName: null,
    lastName: null,
    displayName: null,
    status: "ACTIVE",
    memberships: [],
    activeOrganizationId: "org",
    activePermissions: new Set(permissions),
  };
}

describe("PermissionsGuard", () => {
  it("allows a route with no permission requirements", () => {
    const guard = new PermissionsGuard(reflectorWith({}));
    expect(guard.canActivate(contextFor(user([])))).toBe(true);
  });

  it("allows when the user has the required permission", () => {
    const guard = new PermissionsGuard(reflectorWith({ required: ["cases.read"] }));
    expect(guard.canActivate(contextFor(user(["cases.read"])))).toBe(true);
  });

  it("denies (403) when the required permission is missing", () => {
    const guard = new PermissionsGuard(reflectorWith({ required: ["cases.read"] }));
    expect(() => guard.canActivate(contextFor(user([])))).toThrow(ForbiddenException);
  });

  it("denies (403) when there is no authenticated user", () => {
    const guard = new PermissionsGuard(reflectorWith({ required: ["cases.read"] }));
    expect(() => guard.canActivate(contextFor(null))).toThrow(ForbiddenException);
  });

  it("supports any-of semantics", () => {
    const guard = new PermissionsGuard(reflectorWith({ anyOf: ["users.manage", "users.manage_own_organization"] }));
    expect(guard.canActivate(contextFor(user(["users.manage_own_organization"])))).toBe(true);
    expect(() => guard.canActivate(contextFor(user(["cases.read"])))).toThrow(ForbiddenException);
  });

  it("skips checks for public routes", () => {
    const guard = new PermissionsGuard(reflectorWith({ public: true, required: ["cases.read"] }));
    expect(guard.canActivate(contextFor(null))).toBe(true);
  });
});
