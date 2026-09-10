import type { PrismaClient } from "@prisma/client";
import {
  PERMISSION_DESCRIPTIONS,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  type PermissionCode,
  type RoleCode,
} from "../src/common/rbac";

/**
 * Idempotent sync of roles, permissions, and role→permission mappings from the
 * RBAC definitions.
 *
 * Extracted from the seed so it can be run on its own. The full seed also
 * upserts demo CMS content, and re-running that would overwrite blog posts and
 * testimonials an editor has since changed — which makes it the wrong tool for
 * "a role was added, put it in the database". This function touches nothing but
 * the three RBAC tables.
 *
 * Adding a permission to a role definition grants it here; removing one revokes
 * it, because stale mappings are pruned so the database always matches the
 * definitions exactly.
 */
export async function syncRbac(prisma: PrismaClient): Promise<{ permissions: number; roles: number }> {
  const permissionCodes = Object.values(PERMISSIONS) as PermissionCode[];
  for (const code of permissionCodes) {
    await prisma.permission.upsert({
      where: { code },
      update: { description: PERMISSION_DESCRIPTIONS[code] },
      create: { code, description: PERMISSION_DESCRIPTIONS[code] },
    });
  }
  const permissions = await prisma.permission.findMany();
  const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));

  const roleCodes = Object.keys(ROLE_DEFINITIONS) as RoleCode[];
  for (const code of roleCodes) {
    const def = ROLE_DEFINITIONS[code];
    const role = await prisma.role.upsert({
      where: { code },
      update: { name: def.name, description: def.description, isSystem: true },
      create: { code, name: def.name, description: def.description, isSystem: true },
    });

    const wantedPermissionIds = def.permissions
      .map((c) => permissionIdByCode.get(c))
      .filter((id): id is string => Boolean(id));

    for (const permissionId of wantedPermissionIds) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }

    // Prune mappings no longer in the definition (keeps system roles exact).
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: wantedPermissionIds } },
    });
  }

  return { permissions: permissionCodes.length, roles: roleCodes.length };
}
