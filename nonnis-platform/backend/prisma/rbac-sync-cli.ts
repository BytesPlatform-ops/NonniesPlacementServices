import { PrismaClient } from "@prisma/client";
import { syncRbac } from "./sync-rbac";

/** Applies the RBAC definitions to the database and nothing else. */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const { permissions, roles } = await syncRbac(prisma);
    const inDb = await prisma.role.findMany({ select: { code: true }, orderBy: { code: "asc" } });
    console.log(`Synced ${permissions} permissions and ${roles} roles.`);
    console.log(`Roles now in the database: ${inDb.map((r) => r.code).join(", ")}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
