import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import type { RequestUser } from "../../auth/request-user";
import { WorkflowEventsService } from "../../workflow-events/workflow-events.service";
import { ensureCaseAccess } from "../case-access";
import { toServiceRequestView, type ServiceRequestView } from "../cases.serializer";
import type { CreateServiceRequestDto, UpdateServiceRequestDto } from "./service-requests.dto";

@Injectable()
export class ServiceRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEvents: WorkflowEventsService,
  ) {}

  async list(user: RequestUser, caseId: string): Promise<ServiceRequestView[]> {
    await ensureCaseAccess(this.prisma, user, caseId, false);
    const rows = await this.prisma.serviceRequest.findMany({ where: { caseId }, orderBy: { createdAt: "asc" } });
    return rows.map(toServiceRequestView);
  }

  async create(user: RequestUser, caseId: string, dto: CreateServiceRequestDto): Promise<ServiceRequestView> {
    const kase = await ensureCaseAccess(this.prisma, user, caseId, true);
    const created = await this.prisma.$transaction(async (tx) => {
      const sr = await tx.serviceRequest.create({
        data: { caseId, ...this.mapFields(dto), category: dto.category },
      });
      await this.workflowEvents.record(
        { organizationId: kase.organizationId, caseId, type: "SERVICE_REQUEST_ADDED", source: "MANUAL", actorUserId: user.id, metadata: { serviceRequestId: sr.id, category: sr.category } },
        tx,
      );
      return sr;
    });
    return toServiceRequestView(created);
  }

  async update(user: RequestUser, caseId: string, serviceRequestId: string, dto: UpdateServiceRequestDto): Promise<ServiceRequestView> {
    const kase = await ensureCaseAccess(this.prisma, user, caseId, true);
    const existing = await this.prisma.serviceRequest.findFirst({ where: { id: serviceRequestId, caseId } });
    if (!existing) throw new NotFoundException("Service request not found");

    const updated = await this.prisma.$transaction(async (tx) => {
      const sr = await tx.serviceRequest.update({
        where: { id: serviceRequestId },
        data: { ...this.mapFields(dto), category: dto.category },
      });
      await this.workflowEvents.record(
        { organizationId: kase.organizationId, caseId, type: "SERVICE_REQUEST_UPDATED", source: "MANUAL", actorUserId: user.id, metadata: { serviceRequestId } },
        tx,
      );
      return sr;
    });
    return toServiceRequestView(updated);
  }

  async cancel(user: RequestUser, caseId: string, serviceRequestId: string): Promise<ServiceRequestView> {
    const kase = await ensureCaseAccess(this.prisma, user, caseId, true);
    const existing = await this.prisma.serviceRequest.findFirst({ where: { id: serviceRequestId, caseId } });
    if (!existing) throw new NotFoundException("Service request not found");

    const updated = await this.prisma.$transaction(async (tx) => {
      const sr = await tx.serviceRequest.update({ where: { id: serviceRequestId }, data: { status: "CANCELLED" } });
      await this.workflowEvents.record(
        { organizationId: kase.organizationId, caseId, type: "SERVICE_REQUEST_REMOVED", source: "MANUAL", actorUserId: user.id, metadata: { serviceRequestId } },
        tx,
      );
      return sr;
    });
    return toServiceRequestView(updated);
  }

  private mapFields(dto: UpdateServiceRequestDto) {
    return {
      levelOfCare: dto.levelOfCare,
      requestedStartDate: dto.requestedStartDate ? new Date(dto.requestedStartDate) : undefined,
      frequency: dto.frequency,
      durationText: dto.durationText,
      serviceCity: dto.serviceCity,
      serviceState: dto.serviceState,
      servicePostalCode: dto.servicePostalCode,
      serviceRadiusMiles: dto.serviceRadiusMiles,
      fundingSource: dto.fundingSource,
      insurancePlan: dto.insurancePlan,
      authorizationReference: dto.authorizationReference,
      requiredQualifications: dto.requiredQualifications,
      mandatoryLanguage: dto.mandatoryLanguage,
      equipmentNeeds: dto.equipmentNeeds,
      transportationRequired: dto.transportationRequired,
      notes: dto.notes,
    };
  }
}
