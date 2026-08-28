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

  // 3. Reference catalogs (idempotent by code). These are admin-editable; the
  //    seed only ensures a sensible starting set exists and never deletes rows.
  const serviceCategories: Array<{ code: string; name: string; sortOrder: number }> = [
    { code: "HOME_HEALTH", name: "Home Health" },
    { code: "SKILLED_NURSING", name: "Skilled Nursing" },
    { code: "PHYSICAL_THERAPY", name: "Physical Therapy" },
    { code: "OCCUPATIONAL_THERAPY", name: "Occupational Therapy" },
    { code: "SPEECH_THERAPY", name: "Speech Therapy" },
    { code: "PERSONAL_CARE", name: "Personal Care" },
    { code: "HOMEMAKER", name: "Homemaker" },
    { code: "HOSPICE", name: "Hospice" },
    { code: "PALLIATIVE_CARE", name: "Palliative Care" },
    { code: "INFUSION", name: "Infusion" },
    { code: "WOUND_CARE", name: "Wound Care" },
    { code: "BEHAVIORAL_HEALTH", name: "Behavioral Health" },
    { code: "DURABLE_MEDICAL_EQUIPMENT", name: "Durable Medical Equipment" },
    { code: "TRANSPORTATION", name: "Transportation" },
    { code: "OTHER", name: "Other" },
  ].map((c, i) => ({ ...c, sortOrder: i }));
  for (const c of serviceCategories) {
    await prisma.serviceCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, sortOrder: c.sortOrder },
      create: { code: c.code, name: c.name, sortOrder: c.sortOrder },
    });
  }

  const paymentTypes: Array<{ code: string; name: string }> = [
    { code: "PRIVATE_PAY", name: "Private Pay" },
    { code: "MEDICARE", name: "Medicare" },
    { code: "MEDICAID", name: "Medicaid" },
    { code: "MEDICAID_PENDING", name: "Medicaid Pending" },
    { code: "VA", name: "VA Benefits" },
    { code: "LONG_TERM_CARE_INSURANCE", name: "Long-Term Care Insurance" },
    { code: "COMMERCIAL_INSURANCE", name: "Commercial Insurance" },
    { code: "OTHER", name: "Other" },
  ];
  for (let i = 0; i < paymentTypes.length; i++) {
    const p = paymentTypes[i]!;
    await prisma.paymentType.upsert({
      where: { code: p.code },
      update: { name: p.name, sortOrder: i },
      create: { code: p.code, name: p.name, sortOrder: i },
    });
  }

  const languages: Array<{ code: string; name: string }> = [
    { code: "EN", name: "English" },
    { code: "ES", name: "Spanish" },
    { code: "ZH", name: "Chinese" },
    { code: "VI", name: "Vietnamese" },
    { code: "TL", name: "Tagalog" },
    { code: "KO", name: "Korean" },
    { code: "RU", name: "Russian" },
    { code: "AR", name: "Arabic" },
  ];
  for (let i = 0; i < languages.length; i++) {
    const l = languages[i]!;
    await prisma.language.upsert({
      where: { code: l.code },
      update: { name: l.name, sortOrder: i },
      create: { code: l.code, name: l.name, sortOrder: i },
    });
  }

  const [permissionCount, roleCount, mappingCount, categoryCount, paymentCount, languageCount] = await Promise.all([
    prisma.permission.count(),
    prisma.role.count(),
    prisma.rolePermission.count(),
    prisma.serviceCategory.count(),
    prisma.paymentType.count(),
    prisma.language.count(),
  ]);
  console.log(
    `Seed complete: ${permissionCount} permissions, ${roleCount} roles, ${mappingCount} role-permission mappings, ` +
      `${categoryCount} service categories, ${paymentCount} payment types, ${languageCount} languages.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
