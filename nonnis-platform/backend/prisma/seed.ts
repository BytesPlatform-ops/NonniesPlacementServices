import { PrismaClient } from "@prisma/client";
import {
  PERMISSION_DESCRIPTIONS,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  type PermissionCode,
  type RoleCode,
} from "../src/common/rbac";

const prisma = new PrismaClient();

/**
 * Idempotent seed of roles, permissions, and role→permission mappings.
 * Uses upserts so repeated runs never create duplicates, and prunes stale
 * mappings so the database always matches the RBAC definitions.
 */
async function main(): Promise<void> {
  // 1. Permissions
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

  // 2. Roles + their permission mappings
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

    // Add/keep wanted mappings.
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

  const [permissionCount, roleCount, mappingCount] = await Promise.all([
    prisma.permission.count(),
    prisma.role.count(),
    prisma.rolePermission.count(),
  ]);
  console.log(`Seed complete: ${permissionCount} permissions, ${roleCount} roles, ${mappingCount} role-permission mappings.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
