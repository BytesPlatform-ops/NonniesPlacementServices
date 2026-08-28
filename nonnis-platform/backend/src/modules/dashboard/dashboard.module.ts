import { Module } from "@nestjs/common";
import { ReadinessModule } from "../readiness/readiness.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [ReadinessModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
