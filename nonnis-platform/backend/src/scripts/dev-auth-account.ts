/**
 * DEVELOPMENT-ONLY auth account for automated/manual UI verification.
 *
 * `bootstrap:admin` is the supported way to create a real administrator, but it sends
 * an email invite so the operator can choose their own password — which cannot be
 * driven by an automated visual review. This script creates the same application
 * user/membership through the SAME architecture, but with a password supplied at run
 * time so a browser can actually sign in.
 *
 *   npm run dev:auth-account            # create/update
 *   npm run dev:auth-account -- --remove # delete it again
 *
 * Safety rules:
 *   - refuses to run when NODE_ENV=production
 *   - takes the email AND password from the environment; nothing is hardcoded and no
 *     credential is ever written to a file or committed
 *   - the account is fully removable with --remove
 *
 * Required env: DEV_AUTH_EMAIL, DEV_AUTH_PASSWORD (plus the usual SUPABASE_* / DATABASE_URL).
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { ROLES } from "../common/rbac";

async function main(): Promise<void> {
  if ((process.env.NODE_ENV ?? "development") === "production") {
    console.error("Refusing to manage a development auth account in production.");
    process.exit(1);
  }

  const email = (process.env.DEV_AUTH_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.DEV_AUTH_PASSWORD ?? "";
  const remove = process.argv.includes("--remove");
  if (!email) {
    console.error("Set DEV_AUTH_EMAIL (and DEV_AUTH_PASSWORD when creating).");
    process.exit(1);
  }
  if (!remove && password.length < 12) {
    console.error("Set DEV_AUTH_PASSWORD to at least 12 characters.");
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
    const existingAuth = await findAuthUser(supabase, email);

    if (remove) {
      if (existingAuth) await supabase.auth.admin.deleteUser(existingAuth.id);
      const appUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (appUser) {
        await prisma.organizationMembership.deleteMany({ where: { userId: appUser.id } });
        await prisma.user.delete({ where: { id: appUser.id } });
      }
      console.log(`Removed development auth account for ${email}.`);
      return;
    }

    const role = await prisma.role.findUnique({ where: { code: ROLES.NONNIS_ADMIN } });
    if (!role) throw new Error("NONNIS_ADMIN role not found. Run the seed first: npm run prisma:seed");

    let org = await prisma.organization.findFirst({ where: { type: "NONNIS" } });
    if (!org) org = await prisma.organization.create({ data: { type: "NONNIS", name: "Nonnis", status: "ACTIVE" } });

    // Create the Supabase identity with a known password (pre-confirmed so no inbox is needed).
    let supabaseUserId: string;
    if (existingAuth) {
      const updated = await supabase.auth.admin.updateUserById(existingAuth.id, { password, email_confirm: true });
      if (updated.error) throw updated.error;
      supabaseUserId = existingAuth.id;
    } else {
      const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw created.error ?? new Error("Could not create the auth user.");
      supabaseUserId = created.data.user.id;
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { status: "ACTIVE", supabaseAuthUserId: supabaseUserId, firstName: "Dev", lastName: "Verifier" },
      create: { email, status: "ACTIVE", supabaseAuthUserId: supabaseUserId, firstName: "Dev", lastName: "Verifier" },
    });
    await prisma.organizationMembership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: { roleId: role.id, status: "ACTIVE", joinedAt: new Date() },
      create: { userId: user.id, organizationId: org.id, roleId: role.id, status: "ACTIVE", joinedAt: new Date() },
    });

    // Never print the password.
    console.log(`Development NONNIS_ADMIN ready for ${email} (user ${user.id}, org ${org.id}).`);
  } finally {
    await prisma.$disconnect();
  }
}

/** Supabase has no direct get-by-email admin call; page through the user list. */
async function findAuthUser(supabase: { auth: { admin: { listUsers: (o: { page: number; perPage: number }) => Promise<{ data: { users: Array<{ id: string; email?: string }> }; error: unknown }> } } }, email: string): Promise<{ id: string } | null> {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error as Error;
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) return { id: found.id };
    if (data.users.length < 200) break;
  }
  return null;
}

main().catch((error) => {
  console.error("Development auth account failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
