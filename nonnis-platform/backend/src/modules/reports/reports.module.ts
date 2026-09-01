import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ReportsController } from "./reports.controller";
import { ReportLookupService } from "./report-lookups.service";
import { OverviewService } from "./services/overview.service";
import { ReportOptionsService } from "./services/report-options.service";
import { CasesReportService } from "./services/cases-report.service";
import { ReferralsReportService } from "./services/referrals-report.service";
import { ProvidersReportService } from "./services/providers-report.service";
import { ReadinessReportService } from "./services/readiness-report.service";
import { TasksReportService } from "./services/tasks-report.service";
import { FormSubmissionsReportService } from "./services/form-submissions-report.service";

@Module({
  imports: [AuditModule],
  controllers: [ReportsController],
  providers: [
    ReportLookupService,
    OverviewService,
    ReportOptionsService,
    CasesReportService,
    ReferralsReportService,
    ProvidersReportService,
    ReadinessReportService,
    TasksReportService,
    FormSubmissionsReportService,
  ],
})
export class ReportsModule {}
