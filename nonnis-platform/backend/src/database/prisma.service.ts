import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Thin wrapper around PrismaClient exposed as an injectable service.
 *
 * Connection is lazy: PrismaClient connects on first query, so the application
 * (and tests) can boot without a live database. A real DATABASE_URL is required
 * only when a query actually runs.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    if (!process.env.DATABASE_URL) {
      this.logger.warn("DATABASE_URL is not set — database operations will fail until it is configured.");
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
