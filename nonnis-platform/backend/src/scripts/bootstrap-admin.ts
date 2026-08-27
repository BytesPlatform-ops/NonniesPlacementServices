/**
 * Bootstrap the first Nonnis administrator. Idempotent.
 *
 * Usage:
 *   npm run bootstrap:admin -- admin@example.com
 *   (or set BOOTSTRAP_ADMIN_EMAIL and run without an argument)
 *
 * Requires env: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * The email is supplied by the operator — never hardcoded. No secrets live here.
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { ROLES } from "../common/rbac";

async function main(): Promise<void> {
  const email = (process.argv[2] ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!email) {
    console.error("Provide an email: npm run bootstrap:admin -- <email> (or set BOOTSTRAP_ADMIN_EMAIL).");
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
    const role = await prisma.role.findUnique({ where: { code: ROLES.NONNIS_ADMIN } });
    if (!role) {
      throw new Error("NONNIS_ADMIN role not found. Run the seed first: npm run prisma:seed");
    }

    // Ensure a Nonnis organization exists.
    let org = await prisma.organization.findFirst({ where: { type: "NONNIS" } });
    if (!org) {
      org = await prisma.organization.create({ data: { type: "NONNIS", name: "Nonnis", status: "ACTIVE" } });
      console.log(`Created Nonnis organization ${org.id}`);
    }

    // Invite (or note existing) Supabase auth user; capture the id when available.
    let supabaseUserId: string | undefined;
    const invited = await supabase.auth.admin.inviteUserByEmail(email);
    if (invited.data?.user) {
      supabaseUserId = invited.data.user.id;
      console.log("Sent Supabase invite (check the admin's inbox to set a password).");
    } else {
      console.log("Supabase invite not sent (the user may already exist); continuing to link the application user.");
    }

    // Upsert application user as ACTIVE admin.
    const user = await prisma.user.upsert({
      where: { email },
      update: { status: "ACTIVE", ...(supabaseUserId ? { supabaseAuthUserId: supabaseUserId } : {}) },
      create: { email, status: "ACTIVE", supabaseAuthUserId: supabaseUserId ?? null },
    });

    // Upsert NONNIS_ADMIN membership.
    await prisma.organizationMembership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: { roleId: role.id, status: "ACTIVE", joinedAt: new Date() },
      create: { userId: user.id, organizationId: org.id, roleId: role.id, status: "ACTIVE", joinedAt: new Date() },
    });

    console.log(`Bootstrapped NONNIS_ADMIN for ${email} (user ${user.id}) in organization ${org.id}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Bootstrap failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
