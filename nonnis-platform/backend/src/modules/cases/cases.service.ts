import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma, type CaseStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";
import { requireActiveOrganization } from "../auth/org-context";
import { AuditService } from "../audit/audit.service";
import { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import type { CreateCaseDto } from "./dto/create-case.dto";
import type { ListCasesQueryDto } from "./dto/list-cases.dto";
import type { UpdateCaseDto } from "./dto/update-case.dto";
import type { TransitionCaseDto } from "./dto/transition-case.dto";
import type { AssignCaseDto } from "./dto/assign-case.dto";
import { computeCompleteness } from "./case-assessment";
import { attentionWhere, incompleteWhere, overdueWhere } from "./case-query";
import { checkTransition, isEditable, MANUAL_TRANSITIONS } from "./case-transition";
import {
  caseDetailInclude,
  caseSummaryInclude,
  toAssessmentInput,
  toCaseDetail,
  toCaseSummary,
  type CaseDetail,
  type CaseSummary,
} from "./cases.serializer";

const SORTABLE = new Set(["expectedDischargeDate", "updatedAt", "createdAt", "status", "caseNumber"]);

function allowedTransitionsFor(status: CaseStatus): CaseStatus[] {
  return MANUAL_TRANSITIONS[status] ?? [];
}

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEvents: WorkflowEventsService,
    private readonly audit: AuditService,
  ) {}

  async list(user: RequestUser, query: ListCasesQueryDto): Promise<PaginatedResult<CaseSummary>> {
    const organizationId = requireActiveOrganization(user);
    const now = new Date();
    const where = this.buildWhere(user, organizationId, query, now);

    const sortField = query.sort && SORTABLE.has(query.sort) ? query.sort : "updatedAt";
    const order = query.order === "asc" ? "asc" : "desc";

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        include: caseSummaryInclude,
        orderBy: { [sortField]: order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.case.count({ where }),
    ]);

    return {
      items: rows.map((r) => toCaseSummary(r, now)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  private buildWhere(user: RequestUser, organizationId: string, query: ListCasesQueryDto, now: Date): Prisma.CaseWhereInput {
    const and: Prisma.CaseWhereInput[] = [{ organizationId }];

    if (query.status) and.push({ status: query.status });
    if (query.facilityId) and.push({ originatingFacilityId: query.facilityId });

    if (query.assignedToMe) {
      and.push({ assignedDischargeProfessionalId: user.id });
    } else if (query.assignedUserId) {
      const canBroad = user.activePermissions.has(PERMISSIONS.CASES_READ_ALL);
      if (query.assignedUserId !== user.id && !canBroad) {
        throw new BadRequestException("You are not permitted to filter by another user's assignments.");
      }
      and.push({ assignedDischargeProfessionalId: query.assignedUserId });
    }

    if (query.search) {
      const s = query.search;
      and.push({
        OR: [
          { caseNumber: { contains: s, mode: "insensitive" } },
          { externalCaseId: { contains: s, mode: "insensitive" } },
          { patient: { firstName: { contains: s, mode: "insensitive" } } },
          { patient: { lastName: { contains: s, mode: "insensitive" } } },
        ],
      });
    }

    if (query.expectedFrom) and.push({ expectedDischargeDate: { gte: new Date(query.expectedFrom) } });
    if (query.expectedTo) and.push({ expectedDischargeDate: { lte: new Date(query.expectedTo) } });

    if (query.overdue) and.push(overdueWhere(now));

    if (query.attentionOnly) and.push({ OR: attentionWhere(now) });
    if (query.incompleteOnly) and.push({ OR: incompleteWhere() });

    return { AND: and };
  }

  async findOne(user: RequestUser, id: string): Promise<CaseDetail> {
    const row = await this.loadDetailOrThrow(user, id);
    return toCaseDetail(row, allowedTransitionsFor(row.status));
  }

  async create(user: RequestUser, dto: CreateCaseDto): Promise<CaseDetail> {
    const organizationId = requireActiveOrganization(user);
    if ((dto.patientId && dto.patient) || (!dto.patientId && !dto.patient)) {
      throw new BadRequestException("Provide exactly one of `patientId` or `patient`.");
    }

    const detail = await this.prisma.$transaction(async (tx) => {
      const facility = await tx.facility.findUnique({ where: { id: dto.originatingFacilityId } });
      if (!facility || facility.organizationId !== organizationId) {
        throw new BadRequestException("Originating facility is not valid for this organization.");
      }
      const patientId = await this.resolvePatientId(tx, dto, organizationId);

      const created = await tx.case.create({
        data: {
          caseNumber: this.generateCaseNumber(),
          externalCaseId: dto.externalCaseId,
          status: "DRAFT",
          organizationId,
          patientId,
          originatingFacilityId: facility.id,
          assignedDischargeProfessionalId: dto.assignSelf === false ? undefined : user.id,
          expectedDischargeDate: dto.expectedDischargeDate ? new Date(dto.expectedDischargeDate) : undefined,
          currentCareSetting: dto.currentCareSetting,
          preferredServiceLocation: dto.preferredServiceLocation,
          primaryLanguage: dto.primaryLanguage,
          interpreterRequired: dto.interpreterRequired ?? false,
          communicationPreference: dto.communicationPreference,
          accessibilityNeeds: dto.accessibilityNeeds ?? [],
          patientContactPhone: dto.patientContactPhone,
          representativeName: dto.representativeName,
          representativeRelationship: dto.representativeRelationship,
          representativeContact: dto.representativeContact,
        },
      });

      await this.workflowEvents.record(
        { organizationId, caseId: created.id, type: "CASE_CREATED", newStatus: "DRAFT", source: "MANUAL", actorUserId: user.id, metadata: { caseNumber: created.caseNumber } },
        tx,
      );
      await this.audit.record(
        { action: "case.created", entityType: "Case", entityId: created.id, organizationId, actorUserId: user.id, metadata: { caseNumber: created.caseNumber } },
        tx,
      );

      const full = await tx.case.findUniqueOrThrow({ where: { id: created.id }, include: caseDetailInclude });
      return toCaseDetail(full, allowedTransitionsFor(full.status));
    });
    return detail;
  }

  async update(user: RequestUser, id: string, dto: UpdateCaseDto): Promise<CaseDetail> {
    const existing = await this.loadDetailOrThrow(user, id);
    if (!isEditable(existing.status)) {
      throw new ConflictException("This case can no longer be edited.");
    }
    this.validateDates(dto.expectedDischargeDate, dto.actualDischargeDate);

    const detail = await this.prisma.$transaction(async (tx) => {
      await tx.case.update({
        where: { id },
        data: {
          externalCaseId: dto.externalCaseId,
          expectedDischargeDate: dto.expectedDischargeDate ? new Date(dto.expectedDischargeDate) : undefined,
          actualDischargeDate: dto.actualDischargeDate ? new Date(dto.actualDischargeDate) : undefined,
          currentCareSetting: dto.currentCareSetting,
          preferredServiceLocation: dto.preferredServiceLocation,
          primaryLanguage: dto.primaryLanguage,
          interpreterRequired: dto.interpreterRequired,
          communicationPreference: dto.communicationPreference,
          accessibilityNeeds: dto.accessibilityNeeds,
          patientContactPhone: dto.patientContactPhone,
          representativeName: dto.representativeName,
          representativeRelationship: dto.representativeRelationship,
          representativeContact: dto.representativeContact,
          blocked: dto.blocked,
          blockReason: dto.blockReason,
        },
      });
      await this.workflowEvents.record(
        { organizationId: existing.organization.id, caseId: id, type: "CASE_UPDATED", source: "MANUAL", actorUserId: user.id, metadata: { fields: Object.keys(dto) } },
        tx,
      );
      const full = await tx.case.findUniqueOrThrow({ where: { id }, include: caseDetailInclude });
      return toCaseDetail(full, allowedTransitionsFor(full.status));
    });
    return detail;
  }

  async transition(user: RequestUser, id: string, dto: TransitionCaseDto): Promise<CaseDetail> {
    const row = await this.loadDetailOrThrow(user, id);
    const completeness = computeCompleteness(toAssessmentInput(row));
    const check = checkTransition(row.status, dto.toStatus, completeness);
    if (!check.allowed) {
      throw new UnprocessableEntityException({
        message: check.reason ?? "Transition not permitted.",
        details: { code: "TRANSITION_BLOCKED", blockers: check.blockers ?? [] },
      });
    }

    const detail = await this.prisma.$transaction(async (tx) => {
      await tx.case.update({ where: { id }, data: { status: dto.toStatus } });
      await this.workflowEvents.record(
        { organizationId: row.organization.id, caseId: id, type: "STATUS_CHANGED", previousStatus: row.status, newStatus: dto.toStatus, source: "MANUAL", actorUserId: user.id, metadata: dto.reason ? { reason: dto.reason } : undefined },
        tx,
      );
      if (dto.toStatus === "CANCELLED") {
        await this.audit.record(
          { action: "case.cancelled", entityType: "Case", entityId: id, organizationId: row.organization.id, actorUserId: user.id, metadata: dto.reason ? { reason: dto.reason } : undefined },
          tx,
        );
      }
      const full = await tx.case.findUniqueOrThrow({ where: { id }, include: caseDetailInclude });
      return toCaseDetail(full, allowedTransitionsFor(full.status));
    });
    return detail;
  }

  async assign(user: RequestUser, id: string, dto: AssignCaseDto): Promise<CaseDetail> {
    const row = await this.loadDetailOrThrow(user, id);
    if (!isEditable(row.status)) {
      throw new ConflictException("This case can no longer be reassigned.");
    }
    const organizationId = row.organization.id;
    const previous = row.assignedDischargeProfessional?.id ?? null;
    const next = dto.assignedUserId ?? null;

    if (next) {
      const eligible = await this.prisma.organizationMembership.findFirst({
        where: {
          userId: next,
          organizationId,
          status: "ACTIVE",
          role: { permissions: { some: { permission: { code: PERMISSIONS.CASES_READ } } } },
        },
      });
      if (!eligible) {
        throw new BadRequestException("The selected user is not eligible for assignment in this organization.");
      }
    }

    const type = next === null ? "CASE_UNASSIGNED" : previous === null ? "CASE_ASSIGNED" : "CASE_REASSIGNED";

    const detail = await this.prisma.$transaction(async (tx) => {
      await tx.case.update({ where: { id }, data: { assignedDischargeProfessionalId: next } });
      await this.workflowEvents.record(
        { organizationId, caseId: id, type, source: "MANUAL", actorUserId: user.id, metadata: { previous, next } },
        tx,
      );
      if (type === "CASE_REASSIGNED") {
        await this.audit.record(
          { action: "case.reassigned", entityType: "Case", entityId: id, organizationId, actorUserId: user.id, metadata: { previous, next } },
          tx,
        );
      }
      const full = await tx.case.findUniqueOrThrow({ where: { id }, include: caseDetailInclude });
      return toCaseDetail(full, allowedTransitionsFor(full.status));
    });
    return detail;
  }

  // ---- helpers ----

  /** Loads a case detail row bounded by org access (404 for cross-org unless read_all). */
  private async loadDetailOrThrow(user: RequestUser, id: string) {
    const row = await this.prisma.case.findUnique({ where: { id }, include: caseDetailInclude });
    if (!row) throw new NotFoundException(`Case ${id} not found`);
    const canReadAll = user.activePermissions.has(PERMISSIONS.CASES_READ_ALL);
    if (!canReadAll && row.organizationId !== user.activeOrganizationId) {
      throw new NotFoundException(`Case ${id} not found`);
    }
    return row;
  }

  private validateDates(expected?: string | null, actual?: string | null): void {
    if (expected && actual) {
      if (new Date(actual).getTime() < new Date(expected).getTime() - 365 * 86_400_000) {
        throw new BadRequestException("Actual discharge date is inconsistent with the expected date.");
      }
    }
  }

  private async resolvePatientId(tx: Prisma.TransactionClient, dto: CreateCaseDto, organizationId: string): Promise<string> {
    if (dto.patientId) {
      const patient = await tx.patient.findUnique({ where: { id: dto.patientId } });
      if (!patient || patient.organizationId !== organizationId) {
        throw new BadRequestException("Patient is not valid for this organization.");
      }
      return patient.id;
    }
    const p = dto.patient!;
    const patient = await tx.patient.create({
      data: { organizationId, firstName: p.firstName, lastName: p.lastName, dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : undefined, externalRef: p.externalRef },
    });
    return patient.id;
  }

  private generateCaseNumber(): string {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    return `NPC-${stamp}-${randomBytes(4).toString("hex").toUpperCase()}`;
  }
}
