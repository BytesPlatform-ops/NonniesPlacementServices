import { ConflictException, NotFoundException } from "@nestjs/common";
import type { CaseStatus } from "@prisma/client";
import { PERMISSIONS } from "../../common/rbac";
import type { PrismaService } from "../../database/prisma.service";
import type { RequestUser } from "../auth/request-user";

export interface CaseAccess {
  id: string;
  organizationId: string;
  status: CaseStatus;
}

/**
 * Loads a case bounded by organization access (404 for cross-org unless
 * cases.read_all). For writes, also rejects terminal (non-editable) cases.
 */
export async function ensureCaseAccess(
  prisma: PrismaService,
  user: RequestUser,
  caseId: string,
  forWrite: boolean,
): Promise<CaseAccess> {
  const record = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!record) throw new NotFoundException(`Case ${caseId} not found`);

  const canReadAll = user.activePermissions.has(PERMISSIONS.CASES_READ_ALL);
  if (!canReadAll && record.organizationId !== user.activeOrganizationId) {
    throw new NotFoundException(`Case ${caseId} not found`);
  }
  if (forWrite && (record.status === "COMPLETED" || record.status === "CANCELLED")) {
    throw new ConflictException("This case can no longer be modified.");
  }
  return record;
}
