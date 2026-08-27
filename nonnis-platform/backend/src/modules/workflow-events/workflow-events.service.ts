import { Injectable } from "@nestjs/common";
import type { CaseStatus, Prisma, WorkflowEventSource, WorkflowEventType } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export interface RecordWorkflowEventInput {
  organizationId: string;
  caseId: string;
  type: WorkflowEventType;
  previousStatus?: CaseStatus | null;
  newStatus?: CaseStatus | null;
  actorRef?: string | null;
  actorUserId?: string | null;
  source?: WorkflowEventSource;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Append-only business workflow history for cases. Every meaningful case
 * transition should be recorded here so timelines, analytics and automation
 * have a reliable source of truth. Accepts an optional transaction client.
 */
@Injectable()
export class WorkflowEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordWorkflowEventInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.workflowEvent.create({
      data: {
        organizationId: input.organizationId,
        caseId: input.caseId,
        type: input.type,
        previousStatus: input.previousStatus ?? null,
        newStatus: input.newStatus ?? null,
        actorRef: input.actorRef ?? null,
        actorUserId: input.actorUserId ?? null,
        source: input.source ?? "SYSTEM",
        metadata: input.metadata,
      },
    });
  }

  async listForCase(caseId: string, limit = 50) {
    return this.prisma.workflowEvent.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
