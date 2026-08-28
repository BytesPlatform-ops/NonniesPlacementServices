import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma, type ReferralStatus, type WorkflowEventType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { PaginatedResult } from "../../common/types/api-response";
import { PERMISSIONS } from "../../common/rbac";
import { AuditService } from "../audit/audit.service";
import { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import type { RequestUser } from "../auth/request-user";
import { ReferralAccessService, type ReferralRef } from "./referral-access";
import { ReferralMailService } from "./referral-mail.service";
import { generateReferralReference } from "./referral-reference";
import { canTransitionPlacement, canTransitionReferral, isReferralTerminal } from "./referral-transition";
import { allServiceRequestsPlaced, applyCaseStatus, hasOutstandingInformationRequest } from "./case-status-policy";
import {
  referralDetailInclude,
  referralListInclude,
  toProviderReferralDetail,
  toProviderReferralSummary,
  toStaffReferralDetail,
  toStaffReferralSummary,
  type ProviderReferralDetail,
  type StaffReferralDetail,
  type StaffReferralSummary,
} from "./referrals.serializer";
import type {
  AssignReferralDto,
  ConfirmStartDto,
  CreateReferralDto,
  ListReferralsQueryDto,
  ProvideInformationDto,
  ReportUnsuccessfulStartDto,
  RespondReferralDto,
  SchedulePlacementDto,
  SendReferralDto,
  WithdrawReferralDto,
} from "./dto/referrals.dto";

const ACTIVE_REFERRAL_STATUSES: ReferralStatus[] = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "INFORMATION_REQUESTED",
  "CONDITIONALLY_ACCEPTED",
  "ACCEPTED",
];

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEvents: WorkflowEventsService,
    private readonly audit: AuditService,
    private readonly access: ReferralAccessService,
    private readonly mail: ReferralMailService,
  ) {}

  // ---- helpers ----

  private async event(
    tx: Prisma.TransactionClient,
    organizationId: string,
    caseId: string,
    type: WorkflowEventType,
    actorUserId: string | null,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.workflowEvents.record({ organizationId, caseId, type, source: "MANUAL", actorUserId, metadata }, tx);
  }

  private async resolveNames(userIds: Array<string | null | undefined>): Promise<Map<string, string | null>> {
    const ids = Array.from(new Set(userIds.filter((v): v is string => Boolean(v))));
    const map = new Map<string, string | null>();
    if (ids.length === 0) return map;
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true, firstName: true, lastName: true, email: true },
    });
    for (const u of users) {
      map.set(u.id, u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email);
    }
    return map;
  }

  private async loadStaffDetail(referralId: string): Promise<StaffReferralDetail> {
    const row = await this.prisma.referral.findUnique({ where: { id: referralId }, include: referralDetailInclude });
    if (!row) throw new NotFoundException(`Referral ${referralId} not found`);
    const names = await this.resolveNames([row.assignedProviderUserId, ...row.responses.map((r) => r.actorUserId)]);
    return toStaffReferralDetail(row, names);
  }

  private async loadProviderDetail(referralId: string): Promise<ProviderReferralDetail> {
    const row = await this.prisma.referral.findUnique({ where: { id: referralId }, include: referralDetailInclude });
    if (!row) throw new NotFoundException(`Referral ${referralId} not found`);
    const names = await this.resolveNames([row.assignedProviderUserId, ...row.responses.map((r) => r.actorUserId)]);
    return toProviderReferralDetail(row, names);
  }

  // ---- staff: create / send / withdraw / information / resend ----

  async listForCase(user: RequestUser, caseId: string): Promise<StaffReferralSummary[]> {
    await this.access.ensureCaseForCreate(user, caseId);
    const rows = await this.prisma.referral.findMany({
      where: { caseId },
      include: referralListInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toStaffReferralSummary);
  }

  async findOneStaff(user: RequestUser, referralId: string): Promise<StaffReferralDetail> {
    await this.access.loadForStaff(user, referralId);
    return this.loadStaffDetail(referralId);
  }

  async create(user: RequestUser, caseId: string, serviceRequestId: string, dto: CreateReferralDto): Promise<StaffReferralDetail> {
    const organizationId = await this.access.ensureCaseForCreate(user, caseId);

    const serviceRequest = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      select: { id: true, caseId: true, status: true },
    });
    if (!serviceRequest || serviceRequest.caseId !== caseId) {
      throw new BadRequestException("The service request does not belong to this case.");
    }
    if (serviceRequest.status === "CANCELLED") {
      throw new BadRequestException("Cannot refer a cancelled service request.");
    }

    const provider = await this.prisma.provider.findUnique({ where: { id: dto.providerId }, select: { id: true, status: true } });
    if (!provider) throw new BadRequestException("The selected provider does not exist.");
    if (provider.status === "INACTIVE") throw new BadRequestException("The selected provider is inactive.");

    const duplicate = await this.prisma.referral.findFirst({
      where: { serviceRequestId, providerId: dto.providerId, status: { in: ACTIVE_REFERRAL_STATUSES } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException("An active referral to this provider already exists for this service request.");

    const created = await this.prisma.$transaction(async (tx) => {
      const referral = await this.createWithUniqueReference(tx, {
        caseId,
        serviceRequestId,
        providerId: dto.providerId,
        status: "DRAFT",
        selectedByUserId: user.id,
        responseDueAt: dto.responseDueAt ? new Date(dto.responseDueAt) : null,
        coordinationNote: dto.coordinationNote,
      });
      await this.event(tx, organizationId, caseId, "PROVIDER_SELECTION_STARTED", user.id, { referralId: referral.id });
      await this.event(tx, organizationId, caseId, "REFERRAL_CREATED", user.id, { referralId: referral.id, reference: referral.reference, providerId: dto.providerId });
      await applyCaseStatus(tx, this.workflowEvents, caseId, "MATCHING", ["READY_FOR_REVIEW"], user.id, "Provider selection started");
      await this.audit.record({ action: "referral.created", entityType: "Referral", entityId: referral.id, organizationId, actorUserId: user.id, metadata: { reference: referral.reference } }, tx);
      return referral;
    });

    if (dto.sendNow) {
      return this.send(user, created.id, { responseDueAt: dto.responseDueAt });
    }
    return this.loadStaffDetail(created.id);
  }

  private async createWithUniqueReference(
    tx: Prisma.TransactionClient,
    data: Omit<Prisma.ReferralUncheckedCreateInput, "reference">,
  ) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await tx.referral.create({ data: { ...data, reference: generateReferralReference() } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) continue;
        throw error;
      }
    }
    throw new ConflictException("Could not allocate a unique referral reference.");
  }

  async send(user: RequestUser, referralId: string, dto: SendReferralDto): Promise<StaffReferralDetail> {
    const ref = await this.access.loadForStaff(user, referralId, true);
    if (ref.status !== "DRAFT") {
      throw new UnprocessableEntityException("Only a draft referral can be sent.");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.referral.update({
        where: { id: referralId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          sentByUserId: user.id,
          ...(dto.responseDueAt ? { responseDueAt: new Date(dto.responseDueAt) } : {}),
        },
      });
      await this.event(tx, ref.caseOrganizationId, ref.caseId, "REFERRAL_SENT", user.id, { referralId });
      await applyCaseStatus(tx, this.workflowEvents, ref.caseId, "REFERRAL_SENT", ["READY_FOR_REVIEW", "MATCHING"], user.id, "Referral sent");
    });
    await this.notify(user, ref);
    return this.loadStaffDetail(referralId);
  }

  /** Fire the transactional notification (outside the DB transaction) and record its outcome. */
  private async notify(user: RequestUser, ref: ReferralRef): Promise<void> {
    const meta = await this.prisma.referral.findUnique({
      where: { id: ref.id },
      select: {
        reference: true,
        responseDueAt: true,
        serviceRequest: { select: { category: true } },
        case: { select: { originatingFacility: { select: { name: true } } } },
      },
    });
    if (!meta) return;
    const result = await this.mail.sendReferralNotification({
      referralId: ref.id,
      reference: meta.reference,
      providerId: ref.providerId,
      serviceLabel: meta.serviceRequest.category,
      facilityName: meta.case.originatingFacility.name,
      responseDueAt: meta.responseDueAt,
    });
    await this.prisma.referral.update({
      where: { id: ref.id },
      data: {
        notificationStatus: result.status,
        notificationSentAt: result.status === "SENT" ? new Date() : undefined,
        notificationLastError: result.status === "FAILED" ? (result.error ?? "Unknown error") : null,
      },
    });
    await this.workflowEvents.record({
      organizationId: ref.caseOrganizationId,
      caseId: ref.caseId,
      type: result.status === "SENT" ? "REFERRAL_NOTIFICATION_SENT" : "REFERRAL_NOTIFICATION_FAILED",
      source: "SYSTEM",
      actorUserId: user.id,
      metadata: { referralId: ref.id, recipients: result.recipients.length },
    });
  }

  async resendNotification(user: RequestUser, referralId: string): Promise<StaffReferralDetail> {
    const ref = await this.access.loadForStaff(user, referralId, true);
    if (!["SENT", "VIEWED", "INFORMATION_REQUESTED", "CONDITIONALLY_ACCEPTED"].includes(ref.status)) {
      throw new UnprocessableEntityException("This referral is not in a state where a notification can be resent.");
    }
    await this.notify(user, ref);
    await this.audit.record({ action: "referral.notification_resent", entityType: "Referral", entityId: referralId, organizationId: ref.caseOrganizationId, actorUserId: user.id });
    return this.loadStaffDetail(referralId);
  }

  async withdraw(user: RequestUser, referralId: string, dto: WithdrawReferralDto): Promise<StaffReferralDetail> {
    const ref = await this.access.loadForStaff(user, referralId, true);
    if (isReferralTerminal(ref.status) || ref.status === "ACCEPTED") {
      throw new UnprocessableEntityException("This referral can no longer be withdrawn.");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.referral.update({ where: { id: referralId }, data: { status: "WITHDRAWN", withdrawnAt: new Date(), withdrawReason: dto.reason } });
      await this.event(tx, ref.caseOrganizationId, ref.caseId, "REFERRAL_WITHDRAWN", user.id, { referralId, reason: dto.reason ?? null });
    });
    return this.loadStaffDetail(referralId);
  }

  async provideInformation(user: RequestUser, referralId: string, dto: ProvideInformationDto): Promise<StaffReferralDetail> {
    const ref = await this.access.loadForStaff(user, referralId, true);
    if (ref.status !== "INFORMATION_REQUESTED") {
      throw new UnprocessableEntityException("Information can only be provided while a referral is awaiting it.");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.referralResponse.create({ data: { referralId, type: "INFORMATION_PROVIDED", actorUserId: user.id, message: dto.message } });
      await tx.referral.update({ where: { id: referralId }, data: { status: "VIEWED", lastResponseAt: new Date() } });
      await this.event(tx, ref.caseOrganizationId, ref.caseId, "REFERRAL_INFORMATION_PROVIDED", user.id, { referralId });
      if (!(await hasOutstandingInformationRequest(tx, ref.caseId))) {
        await applyCaseStatus(tx, this.workflowEvents, ref.caseId, "PROVIDER_REVIEWING", ["ADDITIONAL_INFORMATION_REQUIRED"], user.id, "Information provided");
      }
    });
    return this.loadStaffDetail(referralId);
  }

  // ---- provider portal ----

  async providerInbox(user: RequestUser, query: ListReferralsQueryDto): Promise<PaginatedResult<ReturnType<typeof toProviderReferralSummary>>> {
    const orgIds = user.memberships.map((m) => m.organizationId);
    const now = new Date();
    const and: Prisma.ReferralWhereInput[] = [
      { provider: { organizationId: { in: orgIds } } },
      { status: { notIn: ["DRAFT"] } },
    ];
    if (query.status) and.push({ status: query.status });
    if (query.overdueOnly) and.push({ responseDueAt: { lt: now }, status: { in: ["SENT", "VIEWED", "INFORMATION_REQUESTED", "CONDITIONALLY_ACCEPTED"] } });
    if (query.actionRequired) and.push({ status: { in: ["SENT", "VIEWED"] } });
    if (query.search) and.push({ reference: { contains: query.search, mode: "insensitive" } });

    return this.paginate(and, query, toProviderReferralSummary);
  }

  async providerDetail(user: RequestUser, referralId: string): Promise<ProviderReferralDetail> {
    const ref = await this.access.loadForProvider(user, referralId);
    // First secure open records the view exactly once.
    if (ref.status === "SENT") {
      await this.prisma.$transaction(async (tx) => {
        const fresh = await tx.referral.findUnique({ where: { id: referralId }, select: { status: true, viewedAt: true } });
        if (fresh && fresh.status === "SENT" && fresh.viewedAt === null) {
          await tx.referral.update({ where: { id: referralId }, data: { status: "VIEWED", viewedAt: new Date() } });
          await this.event(tx, ref.caseOrganizationId, ref.caseId, "REFERRAL_VIEWED", user.id, { referralId });
          await applyCaseStatus(tx, this.workflowEvents, ref.caseId, "PROVIDER_REVIEWING", ["REFERRAL_SENT"], user.id, "Referral viewed by provider");
        }
      });
    }
    return this.loadProviderDetail(referralId);
  }

  async respond(user: RequestUser, referralId: string, dto: RespondReferralDto): Promise<ProviderReferralDetail> {
    const ref = await this.access.loadForProvider(user, referralId);
    if (!user.activePermissions.has(PERMISSIONS.REFERRALS_RESPOND_OWN)) {
      throw new UnprocessableEntityException("You do not have permission to respond to referrals.");
    }
    if (isReferralTerminal(ref.status)) {
      throw new UnprocessableEntityException("This referral can no longer be responded to.");
    }

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      if (dto.action === "ACCEPT") {
        this.assertTransition(ref.status, "ACCEPTED");
        await tx.referralResponse.create({
          data: { referralId, type: "ACCEPTED", actorUserId: user.id, message: dto.message, proposedStartDate: dto.proposedStartDate ? new Date(dto.proposedStartDate) : null, fundingConfirmed: dto.fundingConfirmed, capacityConfirmed: dto.capacityConfirmed },
        });
        await tx.referral.update({ where: { id: referralId }, data: { status: "ACCEPTED", lastResponseAt: now } });
        const existingPlacement = await tx.placement.findUnique({ where: { referralId }, select: { id: true } });
        if (!existingPlacement) {
          await tx.placement.create({ data: { referralId, status: "ACCEPTED", acceptedAt: now } });
          await this.event(tx, ref.caseOrganizationId, ref.caseId, "PLACEMENT_CREATED", user.id, { referralId });
        }
        await this.event(tx, ref.caseOrganizationId, ref.caseId, "REFERRAL_ACCEPTED", user.id, { referralId });
        if (await allServiceRequestsPlaced(tx, ref.caseId)) {
          await applyCaseStatus(tx, this.workflowEvents, ref.caseId, "ACCEPTED", ["REFERRAL_SENT", "PROVIDER_REVIEWING", "ADDITIONAL_INFORMATION_REQUIRED", "MATCHING"], user.id, "All service requests have an accepted placement");
        }
      } else if (dto.action === "CONDITIONALLY_ACCEPT") {
        this.assertTransition(ref.status, "CONDITIONALLY_ACCEPTED");
        await tx.referralResponse.create({
          data: { referralId, type: "CONDITIONALLY_ACCEPTED", actorUserId: user.id, message: dto.message, conditions: dto.conditions, proposedStartDate: dto.proposedStartDate ? new Date(dto.proposedStartDate) : null, fundingConfirmed: dto.fundingConfirmed, capacityConfirmed: dto.capacityConfirmed },
        });
        await tx.referral.update({ where: { id: referralId }, data: { status: "CONDITIONALLY_ACCEPTED", lastResponseAt: now } });
        await this.event(tx, ref.caseOrganizationId, ref.caseId, "REFERRAL_CONDITIONALLY_ACCEPTED", user.id, { referralId });
        await applyCaseStatus(tx, this.workflowEvents, ref.caseId, "PROVIDER_REVIEWING", ["REFERRAL_SENT"], user.id, "Conditional acceptance received");
      } else if (dto.action === "REQUEST_INFORMATION") {
        this.assertTransition(ref.status, "INFORMATION_REQUESTED");
        await tx.referralResponse.create({ data: { referralId, type: "INFORMATION_REQUESTED", actorUserId: user.id, message: dto.question } });
        await tx.referral.update({ where: { id: referralId }, data: { status: "INFORMATION_REQUESTED", lastResponseAt: now } });
        await this.event(tx, ref.caseOrganizationId, ref.caseId, "REFERRAL_INFORMATION_REQUESTED", user.id, { referralId });
        await applyCaseStatus(tx, this.workflowEvents, ref.caseId, "ADDITIONAL_INFORMATION_REQUIRED", ["REFERRAL_SENT", "PROVIDER_REVIEWING"], user.id, "Provider requested information");
      } else {
        this.assertTransition(ref.status, "DECLINED");
        await tx.referralResponse.create({ data: { referralId, type: "DECLINED", actorUserId: user.id, message: dto.declineNote, declineReason: dto.declineReason } });
        await tx.referral.update({ where: { id: referralId }, data: { status: "DECLINED", lastResponseAt: now } });
        await this.event(tx, ref.caseOrganizationId, ref.caseId, "REFERRAL_DECLINED", user.id, { referralId, declineReason: dto.declineReason });
      }
    });
    return this.loadProviderDetail(referralId);
  }

  async assign(user: RequestUser, referralId: string, dto: AssignReferralDto): Promise<ProviderReferralDetail> {
    const ref = await this.access.loadForProvider(user, referralId);
    const next = dto.assignedUserId ?? null;
    if (next) {
      const eligible = await this.prisma.organizationMembership.findFirst({
        where: {
          userId: next,
          organizationId: ref.providerOrganizationId,
          status: "ACTIVE",
          role: { code: { in: ["PROVIDER_ADMIN", "PROVIDER_STAFF"] } },
        },
        select: { id: true },
      });
      if (!eligible) throw new BadRequestException("The selected user is not an active member of this provider organization.");
    }
    await this.prisma.referral.update({ where: { id: referralId }, data: { assignedProviderUserId: next } });
    await this.audit.record({ action: "referral.assigned", entityType: "Referral", entityId: referralId, actorUserId: user.id, metadata: { assignedUserId: next } });
    return this.loadProviderDetail(referralId);
  }

  // ---- placement / service start ----

  async schedule(user: RequestUser, referralId: string, dto: SchedulePlacementDto, asProvider: boolean): Promise<StaffReferralDetail | ProviderReferralDetail> {
    const ref = asProvider ? await this.access.loadForProvider(user, referralId) : await this.access.loadForStaff(user, referralId, true);
    const placement = await this.prisma.placement.findUnique({ where: { referralId }, select: { id: true, status: true } });
    if (!placement) throw new UnprocessableEntityException("This referral has no accepted placement to schedule.");
    if (!canTransitionPlacement(placement.status, "SCHEDULED")) {
      throw new UnprocessableEntityException(`A ${placement.status} placement cannot be scheduled.`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.placement.update({ where: { referralId }, data: { status: "SCHEDULED", scheduledStartAt: new Date(dto.scheduledStartAt) } });
      await this.event(tx, ref.caseOrganizationId, ref.caseId, "SERVICE_START_SCHEDULED", user.id, { referralId, scheduledStartAt: dto.scheduledStartAt });
    });
    return asProvider ? this.loadProviderDetail(referralId) : this.loadStaffDetail(referralId);
  }

  async confirmStart(user: RequestUser, referralId: string, dto: ConfirmStartDto): Promise<ProviderReferralDetail> {
    const ref = await this.access.loadForProvider(user, referralId);
    const placement = await this.prisma.placement.findUnique({ where: { referralId }, select: { status: true } });
    if (!placement || !canTransitionPlacement(placement.status, "STARTED")) {
      throw new UnprocessableEntityException("This placement cannot be marked as started.");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.placement.update({ where: { referralId }, data: { status: "STARTED", actualStartAt: dto.actualStartAt ? new Date(dto.actualStartAt) : new Date() } });
      await this.event(tx, ref.caseOrganizationId, ref.caseId, "SERVICE_STARTED", user.id, { referralId });
    });
    return this.loadProviderDetail(referralId);
  }

  async reportUnsuccessfulStart(user: RequestUser, referralId: string, dto: ReportUnsuccessfulStartDto): Promise<ProviderReferralDetail> {
    const ref = await this.access.loadForProvider(user, referralId);
    const placement = await this.prisma.placement.findUnique({ where: { referralId }, select: { status: true } });
    if (!placement || !canTransitionPlacement(placement.status, "UNSUCCESSFUL")) {
      throw new UnprocessableEntityException("This placement cannot be marked unsuccessful.");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.placement.update({ where: { referralId }, data: { status: "UNSUCCESSFUL", unsuccessfulAt: new Date(), unsuccessfulReason: dto.reason, unsuccessfulNote: dto.note } });
      await this.event(tx, ref.caseOrganizationId, ref.caseId, "SERVICE_START_UNSUCCESSFUL", user.id, { referralId, reason: dto.reason });
    });
    return this.loadProviderDetail(referralId);
  }

  // ---- operations ----

  async operationsList(query: ListReferralsQueryDto): Promise<PaginatedResult<StaffReferralSummary>> {
    const now = new Date();
    const and: Prisma.ReferralWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    if (query.organizationId) and.push({ case: { organizationId: query.organizationId } });
    if (query.facilityId) and.push({ case: { originatingFacilityId: query.facilityId } });
    if (query.providerId) and.push({ providerId: query.providerId });
    if (query.overdueOnly) and.push({ responseDueAt: { lt: now }, status: { in: ["SENT", "VIEWED", "INFORMATION_REQUESTED", "CONDITIONALLY_ACCEPTED"] } });
    if (query.actionRequired) and.push({ status: { in: ["SENT", "VIEWED", "INFORMATION_REQUESTED"] } });
    if (query.dateFrom) and.push({ createdAt: { gte: new Date(query.dateFrom) } });
    if (query.dateTo) and.push({ createdAt: { lte: new Date(query.dateTo) } });
    if (query.search) {
      and.push({ OR: [{ reference: { contains: query.search, mode: "insensitive" } }, { case: { caseNumber: { contains: query.search, mode: "insensitive" } } }] });
    }
    return this.paginate(and, query, toStaffReferralSummary);
  }

  // ---- shared pagination ----

  private async paginate<T>(
    and: Prisma.ReferralWhereInput[],
    query: ListReferralsQueryDto,
    map: (row: Prisma.ReferralGetPayload<{ include: typeof referralListInclude }>) => T,
  ): Promise<PaginatedResult<T>> {
    const where: Prisma.ReferralWhereInput = and.length > 0 ? { AND: and } : {};
    const sortField = query.sort && ["createdAt", "sentAt", "responseDueAt", "updatedAt"].includes(query.sort) ? query.sort : "createdAt";
    const order = query.order === "asc" ? "asc" : "desc";
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.referral.findMany({ where, include: referralListInclude, orderBy: { [sortField]: order }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.referral.count({ where }),
    ]);
    return { items: rows.map(map), page: query.page, pageSize: query.pageSize, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize) };
  }

  private assertTransition(from: ReferralStatus, to: ReferralStatus): void {
    if (!canTransitionReferral(from, to)) {
      throw new UnprocessableEntityException(`A ${from} referral cannot move to ${to}.`);
    }
  }
}
