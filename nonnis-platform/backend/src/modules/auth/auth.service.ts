import { Injectable } from "@nestjs/common";
import type { AuthState } from "./request-user";

export interface MeResponse {
  authenticated: true;
  provisioned: boolean;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    status: string;
  } | null;
  activeOrganizationId: string | null;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    organizationType: string;
    roleCode: string;
    roleName: string;
    isPrimary: boolean;
    permissions: string[];
  }>;
  organizations: Array<{ id: string; name: string; type: string }>;
  permissions: string[];
}

@Injectable()
export class AuthService {
  /**
   * Builds the authenticated user context for GET /auth/me. Returns only
   * client-safe data — never tokens, credentials, or the service-role key.
   */
  buildMe(state: AuthState): MeResponse {
    const user = state.authUser;

    if (!user) {
      // Authenticated with Supabase but no provisioned application user.
      return {
        authenticated: true,
        provisioned: false,
        user: null,
        activeOrganizationId: null,
        memberships: [],
        organizations: [],
        permissions: [],
      };
    }

    return {
      authenticated: true,
      provisioned: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        status: user.status,
      },
      activeOrganizationId: user.activeOrganizationId,
      memberships: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organizationName,
        organizationType: m.organizationType,
        roleCode: m.roleCode,
        roleName: m.roleName,
        isPrimary: m.isPrimary,
        permissions: m.permissions,
      })),
      organizations: user.memberships.map((m) => ({
        id: m.organizationId,
        name: m.organizationName,
        type: m.organizationType,
      })),
      permissions: [...user.activePermissions],
    };
  }
}
