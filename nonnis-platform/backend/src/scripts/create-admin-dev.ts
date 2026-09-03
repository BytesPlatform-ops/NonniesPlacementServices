/**
 * DEV ONLY — create a ready-to-use NONNIS_ADMIN with a password set directly
 * (no email/SMTP needed), for local development.
 *
 * Usage:
 *   node --env-file=.env -r ts-node/register src/scripts/create-admin-dev.ts <email> <password>
 *
 * Requires env: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Do NOT use this against production. Not committed to source control.
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import {
  PERMISSION_DESCRIPTIONS,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  ROLES,
  type PermissionCode,
  type RoleCode,
} from "../common/rbac";

async function seedRolesAndPermissions(prisma: PrismaClient): Promise<void> {
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
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: wantedPermissionIds } },
    });
  }
  console.log("Roles & permissions ensured.");
}

async function main(): Promise<void> {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const password = process.argv[3] ?? "";
  if (!email || !password) {
    console.error("Usage: create-admin-dev.ts <email> <password>");
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    await seedRolesAndPermissions(prisma);

    const role = await prisma.role.findUnique({ where: { code: ROLES.NONNIS_ADMIN } });
    if (!role) throw new Error("NONNIS_ADMIN role not found after seeding.");

    let org = await prisma.organization.findFirst({ where: { type: "NONNIS" } });
    if (!org) {
      org = await prisma.organization.create({ data: { type: "NONNIS", name: "Nonnis", status: "ACTIVE" } });
      console.log(`Created Nonnis organization ${org.id}`);
    }

    // Create the Supabase auth user WITH a password and pre-confirmed email.
    let supabaseUserId: string | undefined;
    const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.data?.user) {
      supabaseUserId = created.data.user.id;
      console.log("Created Supabase auth user (password set, email confirmed).");
    } else {
      // Likely already exists — find it and reset the password.
      let page = 1;
      let found: { id: string } | undefined;
      // paginate through users to locate the existing one
      for (;;) {
        const list = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        const match = list.data?.users.find((u) => (u.email ?? "").toLowerCase() === email);
        if (match) {
          found = match;
          break;
        }
        if (!list.data || list.data.users.length < 1000) break;
        page += 1;
      }
      if (!found) throw new Error(`Could not create or locate Supabase user for ${email}: ${created.error?.message ?? "unknown"}`);
      supabaseUserId = found.id;
      await supabase.auth.admin.updateUserById(found.id, { password, email_confirm: true });
      console.log("Supabase auth user already existed — password reset and email confirmed.");
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { status: "ACTIVE", supabaseAuthUserId: supabaseUserId ?? null },
      create: { email, status: "ACTIVE", supabaseAuthUserId: supabaseUserId ?? null },
    });

    await prisma.organizationMembership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: { roleId: role.id, status: "ACTIVE", joinedAt: new Date() },
      create: { userId: user.id, organizationId: org.id, roleId: role.id, status: "ACTIVE", joinedAt: new Date() },
    });

    console.log(`\n✅ Admin ready: ${email} (NONNIS_ADMIN) in organization ${org.id}.`);
    console.log("   You can now log in at http://localhost:3001 with this email + password.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("create-admin-dev failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
