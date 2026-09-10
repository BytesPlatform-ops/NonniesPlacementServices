import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CareSeekerAccessStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { ROLES } from "../../common/rbac";
import type { AppConfig } from "../../config/configuration";
import { AuditService } from "../audit/audit.service";
import { SupabaseService } from "../auth/supabase.service";
import { WorkflowEventsService } from "../workflow-events/workflow-events.service";

export interface CareSeekerAccessView {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  userStatus: string;
  relationship: string | null;
  status: CareSeekerAccessStatus;
  statusLabel: string;
  grantedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<CareSeekerAccessStatus, string> = {
  INVITED: "Invited",
  ACTIVE: "Active",
  REVOKED: "Revoked",
};

/**
 * Grants, lists and revokes a family member's access to a case.
 *
 * Reuses the existing identity machinery rather than adding a second one: the
 * application user is the same `User` row every other role uses, and the
 * credential invite is the same Supabase invite `UsersService.invite` sends.
 * The only thing that is new is the grant row itself.
 *
 * Access is never inferred. A family member is linked because someone with
 * `care_seekers.manage` linked them to this specific case — matching contact
 * details on the case grant nothing.
 */
@Injectable()
export class CareSeekerAdminService {
  private readonly logger = new Logger(CareSeekerAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly workflowEvents: WorkflowEventsService,
  ) {}

  private toView(row: {
    id: string;
    userId: string;
    relationship: string | null;
    status: CareSeekerAccessStatus;
    grantedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    user: { email: string; displayName: string | null; firstName: string | null; lastName: string | null; status: string };
  }): CareSeekerAccessView {
    const name =
      row.user.displayName || [row.user.firstName, row.user.lastName].filter(Boolean).join(" ") || null;
    return {
      id: row.id,
      userId: row.userId,
      email: row.user.email,
      name,
      userStatus: row.user.status,
      relationship: row.relationship,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status],
      grantedAt: row.grantedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private readonly userSelect = {
    select: { email: true, displayName: true, firstName: true, lastName: true, status: true },
  } as const;

  async list(caseId: string): Promise<CareSeekerAccessView[]> {
    const rows = await this.prisma.careSeekerCaseAccess.findMany({
      where: { caseId },
      orderBy: { createdAt: "asc" },
      include: { user: this.userSelect },
    });
    return rows.map((r) => this.toView(r));
  }

  /**
   * Links a family member to a case, creating and inviting the user if needed.
   *
   * The database write is atomic and the external Supabase invite follows, in
   * the same order and for the same reason as the organization invite: an
   * external call cannot participate in the transaction, and a recorded grant
   * with a failed email is recoverable while the reverse is not.
   */
  async grant(
    input: {
      caseId: string;
      organizationId: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      relationship?: string | null;
    },
    actorUserId: string,
  ): Promise<CareSeekerAccessView> {
    const email = input.email.trim().toLowerCase();
    if (!email) throw new BadRequestException("An email address is required.");

    const role = await this.prisma.role.findUnique({ where: { code: ROLES.CARE_SEEKER } });
    if (!role) {
      // The role is seeded from the RBAC definitions; a missing row means the
      // deployment has not run `npm run rbac:sync`.
      throw new ServiceUnavailableException("The Care Seeker role is not available. Run the RBAC sync.");
    }

    const accessId = await this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            firstName: input.firstName ?? null,
            lastName: input.lastName ?? null,
            status: "INVITED",
          },
        });
      }

      // A family member must not also be staff or a provider: the two access
      // models are separate by design, and mixing them would give one session
      // both an organization console and a case-scoped portal.
      const membershipCount = await tx.organizationMembership.count({ where: { userId: user.id } });
      if (membershipCount > 0) {
        throw new ConflictException(
          "This person already has organization access. A separate account is needed for family access.",
        );
      }

      const existing = await tx.careSeekerCaseAccess.findUnique({
        where: { userId_caseId: { userId: user.id, caseId: input.caseId } },
      });
      if (existing && existing.status !== "REVOKED") {
        throw new ConflictException("This person already has access to this case.");
      }

      const row = existing
        ? await tx.careSeekerCaseAccess.update({
            where: { id: existing.id },
            data: {
              status: "INVITED",
              roleId: role.id,
              relationship: input.relationship ?? existing.relationship,
              grantedByUserId: actorUserId,
              grantedAt: new Date(),
              revokedAt: null,
              revokedReason: null,
            },
          })
        : await tx.careSeekerCaseAccess.create({
            data: {
              userId: user.id,
              caseId: input.caseId,
              roleId: role.id,
              status: "INVITED",
              relationship: input.relationship ?? null,
              grantedByUserId: actorUserId,
              grantedAt: new Date(),
            },
          });

      await this.audit.record(
        {
          action: "care_seeker.access_granted",
          entityType: "CareSeekerCaseAccess",
          entityId: row.id,
          organizationId: input.organizationId,
          actorUserId,
          metadata: { caseId: input.caseId, email, relationship: row.relationship },
        },
        tx,
      );
      return row.id;
    });

    await this.workflowEvents.record({
      organizationId: input.organizationId,
      caseId: input.caseId,
      type: "CARE_SEEKER_ACCESS_GRANTED",
      actorUserId,
      source: "MANUAL",
      metadata: { accessId, email },
    });

    // External invite — outside the transaction. Reuses the same Supabase
    // invite and callback URL as organization invites.
    const redirectTo = `${this.config.get("frontendUrl", { infer: true })}/auth/callback`;
    const granted = await this.prisma.careSeekerCaseAccess.findUniqueOrThrow({
      where: { id: accessId },
      include: { user: this.userSelect },
    });
    if (granted.user.status === "INVITED") {
      try {
        const { supabaseUserId } = await this.supabase.inviteByEmail(granted.user.email, redirectTo);
        await this.prisma.user.updateMany({
          where: { id: granted.userId, supabaseAuthUserId: null },
          data: { supabaseAuthUserId: supabaseUserId },
        });
      } catch (error) {
        // Family invitations share one email sender with organization invites,
        // so they share its send-rate limit too — and a limit that has been hit
        // is waited out rather than retried. Discarding the reason left the
        // same "please retry" for that and for a genuinely broken sender, with
        // a grant sitting at Invited and no email to account for it.
        const reason = error instanceof Error ? error.message : "unknown error";
        this.logger.warn(`Family invitation email for grant ${accessId} was not sent: ${reason}`);
        throw new ServiceUnavailableException(
          /rate limit/i.test(reason)
            ? "Access was granted, but the email provider's sending rate limit was reached. Wait a few minutes, then revoke and grant the access again to resend the invitation."
            : "Access was granted, but the invitation email could not be sent. Please retry the invite.",
        );
      }
    }

    return this.toView(granted);
  }

  /** Revokes or restores a grant. The row is kept so the history survives. */
  async setStatus(
    input: { caseId: string; organizationId: string; accessId: string; status: "ACTIVE" | "REVOKED"; reason?: string | null },
    actorUserId: string,
  ): Promise<CareSeekerAccessView> {
    const existing = await this.prisma.careSeekerCaseAccess.findFirst({
      where: { id: input.accessId, caseId: input.caseId },
    });
    if (!existing) throw new NotFoundException("Care seeker access not found");

    const row = await this.prisma.careSeekerCaseAccess.update({
      where: { id: existing.id },
      data:
        input.status === "REVOKED"
          ? { status: "REVOKED", revokedAt: new Date(), revokedReason: input.reason?.trim() || null }
          : { status: "ACTIVE", revokedAt: null, revokedReason: null },
      include: { user: this.userSelect },
    });

    await this.audit.record({
      action: input.status === "REVOKED" ? "care_seeker.access_revoked" : "care_seeker.access_restored",
      entityType: "CareSeekerCaseAccess",
      entityId: row.id,
      organizationId: input.organizationId,
      actorUserId,
      metadata: { caseId: input.caseId, status: input.status },
    });
    await this.workflowEvents.record({
      organizationId: input.organizationId,
      caseId: input.caseId,
      type: input.status === "REVOKED" ? "CARE_SEEKER_ACCESS_REVOKED" : "CARE_SEEKER_ACCESS_GRANTED",
      actorUserId,
      source: "MANUAL",
      metadata: { accessId: row.id },
    });
    return this.toView(row);
  }
}
