import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export interface RecordAuditInput {
  action: string;
  entityType: string;
  entityId: string;
  organizationId?: string | null;
  actorRef?: string | null;
  actorUserId?: string | null;
  /** Safe metadata only — never store secrets here. */
  metadata?: Prisma.InputJsonValue;
}

/**
 * Append-only security / admin action history. Distinct from workflow history.
 * Accepts an optional transaction client so audit rows are written atomically
 * with the action they describe.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.auditEvent.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        organizationId: input.organizationId ?? null,
        actorRef: input.actorRef ?? null,
        actorUserId: input.actorUserId ?? null,
        metadata: input.metadata,
      },
    });
  }
}
