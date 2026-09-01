import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../database/prisma.service";
import { ACTIVE_STATUSES } from "../../cases/case-query";
import { criticalBlockerWhere } from "../../readiness/readiness-query";
import { OverviewReportDto } from "../dto/report-filters.dto";
import { readinessLevelWhere } from "../report-readiness";
import { buildDateRange } from "../report-shared";

export interface OverviewSummary {
  appliedFilters: Record<string, unknown>;
  generatedAt: string;
  cases: { total: number; active: number; completed: number; cancelled: number };
  referrals: {
    total: number;
    sent: number;
    informationRequested: number;
    conditionallyAccepted: number;
    accepted: number;
    declined: number;
  };
  providers: { total: number; active: number; paused: number; inactive: number };
  readiness: { ready: number; needsAttention: number; blocked: number };
  tasks: { open: number; inProgress: number; completed: number; overdue: number };
  submissions: { received: number; new: number; inReview: number; resolved: number; archived: number };
}

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(filters: OverviewReportDto): Promise<OverviewSummary> {
    const now = new Date();
    const range = buildDateRange(filters.dateFrom, filters.dateTo);
    const org = filters.organizationId;
    const facility = filters.facilityId;

    const caseWhere: Prisma.CaseWhereInput = {
      ...(org ? { organizationId: org } : {}),
      ...(facility ? { originatingFacilityId: facility } : {}),
      ...(range ? { createdAt: range } : {}),
    };
    const referralWhere: Prisma.ReferralWhereInput = {
      status: { not: "DRAFT" },
      ...(org || facility
        ? { case: { ...(org ? { organizationId: org } : {}), ...(facility ? { originatingFacilityId: facility } : {}) } }
        : {}),
      ...(range ? { sentAt: range } : {}),
    };
    const providerWhere: Prisma.ProviderWhereInput = org ? { organizationId: org } : {};
    const readinessWhere: Prisma.CaseWhereInput = {
      ...(org ? { organizationId: org } : {}),
      ...(facility ? { originatingFacilityId: facility } : {}),
    };
    const taskWhere: Prisma.TaskWhereInput = {
      ...(org ? { organizationId: org } : {}),
      ...(facility ? { case: { originatingFacilityId: facility } } : {}),
      ...(range ? { createdAt: range } : {}),
    };
    const submissionWhere: Prisma.WebsiteFormSubmissionWhereInput = range ? { submittedAt: range } : {};
    const and = (base: Prisma.CaseWhereInput, extra: Prisma.CaseWhereInput): Prisma.CaseWhereInput => ({ AND: [base, extra] });

    const [
      caseTotal,
      caseActive,
      caseCompleted,
      caseCancelled,
      refTotal,
      refSent,
      refInfo,
      refCond,
      refAccepted,
      refDeclined,
      provTotal,
      provActive,
      provPaused,
      provInactive,
      readReady,
      readNeeds,
      readBlocked,
      taskOpen,
      taskInProgress,
      taskCompleted,
      taskOverdue,
      subTotal,
      subNew,
      subInReview,
      subResolved,
      subArchived,
    ] = await this.prisma.$transaction([
      this.prisma.case.count({ where: caseWhere }),
      this.prisma.case.count({ where: { AND: [caseWhere, { status: { in: ACTIVE_STATUSES } }] } }),
      this.prisma.case.count({ where: { AND: [caseWhere, { status: "COMPLETED" }] } }),
      this.prisma.case.count({ where: { AND: [caseWhere, { status: "CANCELLED" }] } }),
      this.prisma.referral.count({ where: referralWhere }),
      this.prisma.referral.count({ where: { AND: [referralWhere, { status: "SENT" }] } }),
      this.prisma.referral.count({ where: { AND: [referralWhere, { status: "INFORMATION_REQUESTED" }] } }),
      this.prisma.referral.count({ where: { AND: [referralWhere, { status: "CONDITIONALLY_ACCEPTED" }] } }),
      this.prisma.referral.count({ where: { AND: [referralWhere, { status: "ACCEPTED" }] } }),
      this.prisma.referral.count({ where: { AND: [referralWhere, { status: "DECLINED" }] } }),
      this.prisma.provider.count({ where: providerWhere }),
      this.prisma.provider.count({ where: { AND: [providerWhere, { status: "ACTIVE" }] } }),
      this.prisma.provider.count({ where: { AND: [providerWhere, { status: "PAUSED" }] } }),
      this.prisma.provider.count({ where: { AND: [providerWhere, { status: "INACTIVE" }] } }),
      this.prisma.case.count({ where: and(readinessWhere, readinessLevelWhere("READY")) }),
      this.prisma.case.count({ where: and(readinessWhere, readinessLevelWhere("NEEDS_ATTENTION")) }),
      this.prisma.case.count({ where: and(readinessWhere, criticalBlockerWhere()) }),
      this.prisma.task.count({ where: { AND: [taskWhere, { status: "OPEN" }] } }),
      this.prisma.task.count({ where: { AND: [taskWhere, { status: "IN_PROGRESS" }] } }),
      this.prisma.task.count({ where: { AND: [taskWhere, { status: "COMPLETED" }] } }),
      this.prisma.task.count({ where: { AND: [taskWhere, { dueAt: { lt: now }, status: { in: ["OPEN", "IN_PROGRESS"] } }] } }),
      this.prisma.websiteFormSubmission.count({ where: submissionWhere }),
      this.prisma.websiteFormSubmission.count({ where: { AND: [submissionWhere, { status: "NEW" }] } }),
      this.prisma.websiteFormSubmission.count({ where: { AND: [submissionWhere, { status: "IN_REVIEW" }] } }),
      this.prisma.websiteFormSubmission.count({ where: { AND: [submissionWhere, { status: "RESOLVED" }] } }),
      this.prisma.websiteFormSubmission.count({ where: { AND: [submissionWhere, { status: "ARCHIVED" }] } }),
    ]);

    return {
      appliedFilters: {
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
        organizationId: org ?? null,
        facilityId: facility ?? null,
      },
      generatedAt: now.toISOString(),
      cases: { total: caseTotal, active: caseActive, completed: caseCompleted, cancelled: caseCancelled },
      referrals: {
        total: refTotal,
        sent: refSent,
        informationRequested: refInfo,
        conditionallyAccepted: refCond,
        accepted: refAccepted,
        declined: refDeclined,
      },
      providers: { total: provTotal, active: provActive, paused: provPaused, inactive: provInactive },
      readiness: { ready: readReady, needsAttention: readNeeds, blocked: readBlocked },
      tasks: { open: taskOpen, inProgress: taskInProgress, completed: taskCompleted, overdue: taskOverdue },
      submissions: { received: subTotal, new: subNew, inReview: subInReview, resolved: subResolved, archived: subArchived },
    };
  }
}
