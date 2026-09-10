/**
 * Test Care Seeker account for manual verification of the family portal.
 *
 * The supported way to create a real family member is the Family Access tab on a case,
 * which sends an email invitation so the person chooses their own password. That cannot
 * be driven by a manual test run, so this script creates the same application user and
 * the same CareSeekerCaseAccess grant through the SAME architecture, with a password
 * supplied at run time so a browser can sign in.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS SCRIPT IS DRY-RUN BY DEFAULT
 *
 * This repository has ONE database. `backend/.env` points at the same Supabase
 * project that serves the live API, and it does not set NODE_ENV, so a
 * "NODE_ENV !== production" check would pass while writing to live data. A
 * guard that only reads NODE_ENV would therefore be no guard at all.
 *
 * So the guard is the write path itself: nothing is written unless `--apply` is
 * passed, and when the target database is not on localhost, `--apply` alone is
 * refused — an explicit `--allow-shared-database` acknowledgement is also
 * required. Running the script with no flags reports exactly what it WOULD do
 * and changes nothing.
 * ---------------------------------------------------------------------------
 *
 *   npm run dev:care-seeker                     # dry run: report only, writes nothing
 *   npm run dev:care-seeker -- --apply          # write (localhost databases only)
 *   npm run dev:care-seeker -- --apply --allow-shared-database
 *                                               # write to a shared/hosted database
 *   npm run dev:care-seeker -- --remove --apply --allow-shared-database
 *                                               # delete the test account again
 *
 * Other safety rules:
 *   - refuses outright when NODE_ENV=production
 *   - email AND password come from the environment; nothing is hardcoded, nothing is
 *     written to a file, and the password is never printed
 *   - refuses to touch an existing user who has organization access, or any existing
 *     user that is not already a family-only test account — so it can never overwrite
 *     a real person's record
 *   - it only ever ADDS a user and a grant. It never edits the case, the patient, the
 *     providers, or any referral.
 *
 * Required env: DEV_SEEKER_EMAIL, DEV_SEEKER_PASSWORD (plus the usual SUPABASE_* / DATABASE_URL).
 * Optional env: DEV_SEEKER_CASE_NUMBER — the case to link. Defaults to the most recently
 *               updated case that is neither cancelled nor completed.
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { ROLES } from "../common/rbac";

/** Host and Supabase project of the database this run would touch. */
function describeTarget(): { host: string; projectRef: string; isLocal: boolean } {
  let host = "unknown";
  try {
    const parsed = new URL(process.env.DATABASE_URL ?? "");
    host = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  } catch {
    /* leave as unknown — treated as non-local below */
  }
  const projectRef = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(process.env.SUPABASE_URL ?? "")?.[1] ?? "unknown";
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/.test(host);
  return { host, projectRef, isLocal };
}

async function main(): Promise<void> {
  if ((process.env.NODE_ENV ?? "development") === "production") {
    console.error("Refusing to run with NODE_ENV=production.");
    process.exit(1);
  }

  const email = (process.env.DEV_SEEKER_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.DEV_SEEKER_PASSWORD ?? "";
  const caseNumber = (process.env.DEV_SEEKER_CASE_NUMBER ?? "").trim();
  const remove = process.argv.includes("--remove");
  const apply = process.argv.includes("--apply");
  const allowShared = process.argv.includes("--allow-shared-database");

  if (!email) {
    console.error("Set DEV_SEEKER_EMAIL (and DEV_SEEKER_PASSWORD when creating).");
    process.exit(1);
  }
  if (!remove && !password) {
    console.error("Set DEV_SEEKER_PASSWORD (at least 12 characters) when creating.");
    process.exit(1);
  }
  if (!remove && password.length < 12) {
    console.error("DEV_SEEKER_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }

  const target = describeTarget();
  const writing = apply && (target.isLocal || allowShared);

  console.log("Target database");
  console.log(`  host             : ${target.host}`);
  console.log(`  supabase project : ${target.projectRef}`);
  console.log(`  classification   : ${target.isLocal ? "LOCAL" : "SHARED / HOSTED — treat as live data"}`);
  console.log(`  mode             : ${writing ? "APPLY (will write)" : "DRY RUN (writes nothing)"}`);
  console.log();

  if (apply && !target.isLocal && !allowShared) {
    console.error("Refusing to write: this database is not on localhost.");
    console.error("If you intend to write to it, re-run with --allow-shared-database as well.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const existingAuth = await findAuthUser(supabase, email);

    // The application user is looked up on the TRIMMED, lower-cased address
    // rather than by exact match. At least one real row in this database has a
    // trailing newline in its email, and an exact-match lookup silently misses
    // it — which would make every guard below pass for an account that plainly
    // should have been refused.
    const matches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM users WHERE lower(btrim(email)) = ${email} LIMIT 2
    `;
    const appUser =
      matches.length > 0
        ? await prisma.user.findUnique({
            where: { id: matches[0]!.id },
            select: { id: true, email: true, status: true, _count: { select: { memberships: true, careSeekerAccess: true } } },
          })
        : null;

    const isFamilyOnlyTestAccount =
      appUser !== null && appUser._count.memberships === 0 && appUser._count.careSeekerAccess > 0;

    // ---- Never touch anybody but a family test account ----------------------
    //
    // Checked before ANY write, and before the Supabase call in particular:
    // `updateUserById` would reset a real person's password, which no amount of
    // later validation can undo.
    if (existingAuth && !isFamilyOnlyTestAccount) {
      console.error(`Refusing: a sign-in identity already exists for ${email}.`);
      console.error("Creating it would reset that account's password. Use a dedicated test email.");
      process.exit(1);
    }
    if (appUser && appUser._count.memberships > 0) {
      console.error(`Refusing: ${email} already has organization access (staff or provider).`);
      console.error("Use a different, dedicated email for a family test account.");
      process.exit(1);
    }
    if (appUser && !isFamilyOnlyTestAccount) {
      // An existing user with no memberships and no family grant is somebody
      // else's record — an invited staff member, or a family member whose grant
      // was revoked. Upserting would rewrite their name and identity link.
      console.error(`Refusing: an unrelated user already exists for ${email}.`);
      console.error("Use a different, dedicated email for a family test account.");
      process.exit(1);
    }

    if (remove) {
      const grants = appUser ? await prisma.careSeekerCaseAccess.count({ where: { userId: appUser.id } }) : 0;
      const messages = appUser
        ? await prisma.message.count({ where: { senderUserId: appUser.id, scope: "CARE_SEEKER" } })
        : 0;

      if (!writing) {
        console.log("Would remove:");
        console.log(`  supabase auth user : ${existingAuth ? "yes" : "none found"}`);
        console.log(`  application user   : ${appUser ? appUser.id : "none found"}`);
        console.log(`  family grants      : ${grants}`);
        console.log(`  family messages    : ${messages}`);
        console.log("\nNothing was changed. Re-run with --apply to remove.");
        return;
      }

      if (existingAuth) await supabase.auth.admin.deleteUser(existingAuth.id);
      if (appUser) {
        // Only this user's own rows. The case, patient and referrals are untouched.
        await prisma.careSeekerCaseAccess.deleteMany({ where: { userId: appUser.id } });
        await prisma.message.deleteMany({ where: { senderUserId: appUser.id, scope: "CARE_SEEKER" } });
        await prisma.user.delete({ where: { id: appUser.id } });
        console.log(`Removed the test Care Seeker for ${email} (${grants} grant(s), ${messages} message(s)).`);
      } else {
        console.log(`No application user found for ${email}; nothing to remove.`);
      }
      return;
    }

    const role = await prisma.role.findUnique({ where: { code: ROLES.CARE_SEEKER } });
    if (!role) throw new Error("CARE_SEEKER role not found. Run: npm run rbac:sync");

    const found = caseNumber
      ? await prisma.case.findUnique({
          where: { caseNumber },
          select: { id: true, caseNumber: true, status: true, patient: { select: { firstName: true, lastName: true } } },
        })
      : await prisma.case.findFirst({
          where: { status: { notIn: ["CANCELLED", "COMPLETED"] } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, caseNumber: true, status: true, patient: { select: { firstName: true, lastName: true } } },
        });
    if (!found) {
      throw new Error(
        caseNumber ? `No case found with number ${caseNumber}.` : "No open case found to link. Create one first.",
      );
    }

    if (!writing) {
      console.log("Would create / update:");
      console.log(`  supabase auth user : ${existingAuth ? "update password for the existing identity" : "create"}`);
      console.log(`  application user   : ${appUser ? `update ${appUser.id}` : "create"} (${email})`);
      console.log(`  role granted       : ${ROLES.CARE_SEEKER}`);
      console.log(`  linked case        : ${found.caseNumber} — ${found.patient.firstName} ${found.patient.lastName} (${found.status})`);
      console.log();
      console.log("Would NOT touch: the case record, the patient, any provider, any referral,");
      console.log("                 any other user, or any organization membership.");
      console.log("\nNothing was changed. Re-run with --apply to create it.");
      return;
    }

    // Supabase identity with a known password, pre-confirmed so no inbox is needed.
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
      update: { status: "ACTIVE", supabaseAuthUserId: supabaseUserId, firstName: "Test", lastName: "Family" },
      create: { email, status: "ACTIVE", supabaseAuthUserId: supabaseUserId, firstName: "Test", lastName: "Family" },
    });

    // ACTIVE rather than INVITED: there is no invitation email to accept here.
    await prisma.careSeekerCaseAccess.upsert({
      where: { userId_caseId: { userId: user.id, caseId: found.id } },
      update: { roleId: role.id, status: "ACTIVE", grantedAt: new Date(), revokedAt: null, revokedReason: null },
      create: {
        userId: user.id,
        caseId: found.id,
        roleId: role.id,
        status: "ACTIVE",
        relationship: "Daughter",
        grantedAt: new Date(),
      },
    });

    // Never print the password.
    console.log(`Test CARE_SEEKER ready for ${email}`);
    console.log(`  linked case : ${found.caseNumber} (${found.patient.firstName} ${found.patient.lastName})`);
    console.log(`  sign in at  : ${process.env.FRONTEND_URL ?? "http://localhost:3001"}/login  ->  redirects to /seeker`);
    console.log(`  remove with : npm run dev:care-seeker -- --remove --apply${target.isLocal ? "" : " --allow-shared-database"}`);
  } finally {
    await prisma.$disconnect();
  }
}

/** Supabase has no direct get-by-email admin call; page through the user list. */
async function findAuthUser(
  supabase: {
    auth: {
      admin: {
        listUsers: (o: { page: number; perPage: number }) => Promise<{
          data: { users: Array<{ id: string; email?: string }> };
          error: unknown;
        }>;
      };
    };
  },
  email: string,
): Promise<{ id: string } | null> {
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
  console.error("Test Care Seeker account failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
