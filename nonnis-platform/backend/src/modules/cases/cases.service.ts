import { randomBytes } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import type { RequestUser } from "../auth/request-user";
import { requireActiveOrganization } from "../auth/org-context";
import { AuditService } from "../audit/audit.service";
import { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import type { CreateCaseDto } from "./dto/create-case.dto";
import type { ListCasesQueryDto } from "./dto/list-cases.dto";
import {
  caseDetailInclude,
  caseSummaryInclude,
  toCaseDetail,
  toCaseSummary,
  type CaseDetail,
  type CaseSummary,
} from "./cases.serializer";

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEvents: WorkflowEventsService,
    private readonly audit: AuditService,
  ) {}

  /** List cases within the caller's active organization. */
  async list(user: RequestUser, query: ListCasesQueryDto): Promise<PaginatedResult<CaseSummary>> {
    const organizationId = requireActiveOrganization(user);
    const { page, pageSize, status } = query;
    const where: Prisma.CaseWhereInput = { organizationId, ...(status ? { status } : {}) };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({
        where,
        include: caseSummaryInclude,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.case.count({ where }),
    ]);

    return {
      items: rows.map(toCaseSummary),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  /**
   * Fetch a single case. Cross-organization access is denied with 404 (not 403)
   * so record existence is never revealed, unless the caller holds cases.read_all.
   */
  async findOne(user: RequestUser, id: string): Promise<CaseDetail> {
    const row = await this.prisma.case.findUnique({ where: { id }, include: caseDetailInclude });
    if (!row) {
      throw new NotFoundException(`Case ${id} not found`);
    }

    const canReadAll = user.activePermissions.has(PERMISSIONS.CASES_READ_ALL);
    if (!canReadAll && row.organizationId !== user.activeOrganizationId) {
      throw new NotFoundException(`Case ${id} not found`);
    }

    return toCaseDetail(row);
  }

  /** Create a case within the caller's active organization only. */
  async create(user: RequestUser, dto: CreateCaseDto): Promise<CaseDetail> {
    const organizationId = requireActiveOrganization(user);

    if ((dto.patientId && dto.patient) || (!dto.patientId && !dto.patient)) {
      throw new BadRequestException("Provide exactly one of `patientId` or `patient`.");
    }

    const detail = await this.prisma.$transaction(async (tx) => {
      const facility = await tx.facility.findUnique({ where: { id: dto.originatingFacilityId } });
      if (!facility || facility.organizationId !== organizationId) {
        // Do not reveal whether a facility in another organization exists.
        throw new BadRequestException("Originating facility is not valid for this organization.");
      }

      const patientId = await this.resolvePatientId(tx, dto, organizationId);

      const created = await tx.case.create({
        data: {
          caseNumber: this.generateCaseNumber(),
          externalCaseId: dto.externalCaseId,
          status: dto.status ?? "DRAFT",
          organizationId,
          patientId,
          originatingFacilityId: facility.id,
          assignedDischargeProfessionalId: user.id,
          expectedDischargeDate: dto.expectedDischargeDate ? new Date(dto.expectedDischargeDate) : undefined,
          currentCareSetting: dto.currentCareSetting,
          preferredServiceLocation: dto.preferredServiceLocation,
          primaryLanguage: dto.primaryLanguage,
          interpreterRequired: dto.interpreterRequired ?? false,
          communicationPreference: dto.communicationPreference,
          accessibilityNeeds: dto.accessibilityNeeds ?? [],
          serviceRequests: {
            create: (dto.serviceRequests ?? []).map((sr) => ({
              category: sr.category,
              levelOfCare: sr.levelOfCare,
              requestedStartDate: sr.requestedStartDate ? new Date(sr.requestedStartDate) : undefined,
              frequency: sr.frequency,
              durationText: sr.durationText,
              serviceCity: sr.serviceCity,
              serviceState: sr.serviceState,
              servicePostalCode: sr.servicePostalCode,
              serviceRadiusMiles: sr.serviceRadiusMiles,
              fundingSource: sr.fundingSource,
              insurancePlan: sr.insurancePlan,
              authorizationReference: sr.authorizationReference,
              notes: sr.notes,
            })),
          },
          requirements: {
            create: (dto.requirements ?? []).map((r) => ({
              category: r.category,
              label: r.label,
              detail: r.detail,
              mandatory: r.mandatory ?? true,
            })),
          },
        },
      });

      await this.workflowEvents.record(
        {
          organizationId,
          caseId: created.id,
          type: "CASE_CREATED",
          newStatus: created.status,
          source: "MANUAL",
          actorUserId: user.id,
          metadata: { caseNumber: created.caseNumber },
        },
        tx,
      );

      await this.audit.record(
        {
          action: "case.created",
          entityType: "Case",
          entityId: created.id,
          organizationId,
          actorUserId: user.id,
          metadata: { caseNumber: created.caseNumber },
        },
        tx,
      );

      const full = await tx.case.findUniqueOrThrow({ where: { id: created.id }, include: caseDetailInclude });
      return toCaseDetail(full);
    });

    return detail;
  }

  private async resolvePatientId(
    tx: Prisma.TransactionClient,
    dto: CreateCaseDto,
    organizationId: string,
  ): Promise<string> {
    if (dto.patientId) {
      const patient = await tx.patient.findUnique({ where: { id: dto.patientId } });
      if (!patient || patient.organizationId !== organizationId) {
        throw new BadRequestException("Patient is not valid for this organization.");
      }
      return patient.id;
    }

    const patientInput = dto.patient!;
    const patient = await tx.patient.create({
      data: {
        organizationId,
        firstName: patientInput.firstName,
        lastName: patientInput.lastName,
        dateOfBirth: patientInput.dateOfBirth ? new Date(patientInput.dateOfBirth) : undefined,
        externalRef: patientInput.externalRef,
      },
    });
    return patient.id;
  }

  private generateCaseNumber(): string {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    return `NPC-${stamp}-${randomBytes(4).toString("hex").toUpperCase()}`;
  }
}
