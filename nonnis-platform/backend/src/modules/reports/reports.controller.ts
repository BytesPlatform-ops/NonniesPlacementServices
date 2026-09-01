import { Controller, Get, Query, Res, UnprocessableEntityException } from "@nestjs/common";
import type { Response } from "express";
import { PERMISSIONS } from "../../common/rbac";
import { SkipTransform } from "../../common/decorators/skip-transform.decorator";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { AuditService } from "../audit/audit.service";
import { csvFilename, MAX_EXPORT_ROWS } from "./csv";
import {
  CasesReportDto,
  FormSubmissionsReportDto,
  OverviewReportDto,
  ProvidersReportDto,
  ReadinessReportDto,
  ReferralsReportDto,
  TasksReportDto,
} from "./dto/report-filters.dto";
import { OverviewService } from "./services/overview.service";
import { ReportOptionsService } from "./services/report-options.service";
import { CasesReportService } from "./services/cases-report.service";
import { ReferralsReportService } from "./services/referrals-report.service";
import { ProvidersReportService } from "./services/providers-report.service";
import { ReadinessReportService } from "./services/readiness-report.service";
import { TasksReportService } from "./services/tasks-report.service";
import { FormSubmissionsReportService } from "./services/form-submissions-report.service";

type ExportResult = { csv: string; rowCount: number } | { tooMany: number };

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly overview: OverviewService,
    private readonly optionsService: ReportOptionsService,
    private readonly cases: CasesReportService,
    private readonly referrals: ReferralsReportService,
    private readonly providers: ProvidersReportService,
    private readonly readiness: ReadinessReportService,
    private readonly tasks: TasksReportService,
    private readonly submissions: FormSubmissionsReportService,
    private readonly audit: AuditService,
  ) {}

  // ---- Overview -----------------------------------------------------------

  @Get("overview")
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  getOverview(@Query() query: OverviewReportDto) {
    return this.overview.overview(query);
  }

  @Get("filter-options")
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  getFilterOptions() {
    return this.optionsService.options();
  }

  // ---- Report data --------------------------------------------------------

  @Get("cases")
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  getCases(@Query() query: CasesReportDto) {
    return this.cases.report(query);
  }

  @Get("referrals")
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  getReferrals(@Query() query: ReferralsReportDto) {
    return this.referrals.report(query);
  }

  @Get("providers")
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  getProviders(@Query() query: ProvidersReportDto) {
    return this.providers.report(query);
  }

  @Get("readiness")
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  getReadiness(@Query() query: ReadinessReportDto) {
    return this.readiness.report(query);
  }

  @Get("tasks")
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  getTasks(@Query() query: TasksReportDto) {
    return this.tasks.report(query);
  }

  @Get("form-submissions")
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  getFormSubmissions(@Query() query: FormSubmissionsReportDto) {
    return this.submissions.report(query);
  }

  // ---- CSV exports --------------------------------------------------------

  @Get("cases/export")
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @SkipTransform()
  async exportCases(@CurrentUser() user: RequestUser, @Query() query: CasesReportDto, @Res() res: Response) {
    await this.deliver(res, user, "cases", await this.cases.export(query), query);
  }

  @Get("referrals/export")
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @SkipTransform()
  async exportReferrals(@CurrentUser() user: RequestUser, @Query() query: ReferralsReportDto, @Res() res: Response) {
    await this.deliver(res, user, "referrals", await this.referrals.export(query), query);
  }

  @Get("providers/export")
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @SkipTransform()
  async exportProviders(@CurrentUser() user: RequestUser, @Query() query: ProvidersReportDto, @Res() res: Response) {
    await this.deliver(res, user, "providers", await this.providers.export(query), query);
  }

  @Get("readiness/export")
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @SkipTransform()
  async exportReadiness(@CurrentUser() user: RequestUser, @Query() query: ReadinessReportDto, @Res() res: Response) {
    await this.deliver(res, user, "readiness", await this.readiness.export(query), query);
  }

  @Get("tasks/export")
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @SkipTransform()
  async exportTasks(@CurrentUser() user: RequestUser, @Query() query: TasksReportDto, @Res() res: Response) {
    await this.deliver(res, user, "tasks", await this.tasks.export(query), query);
  }

  @Get("form-submissions/export")
  @RequirePermissions(PERMISSIONS.REPORTS_EXPORT)
  @SkipTransform()
  async exportFormSubmissions(
    @CurrentUser() user: RequestUser,
    @Query() query: FormSubmissionsReportDto,
    @Res() res: Response,
  ) {
    await this.deliver(res, user, "form-submissions", await this.submissions.export(query), query);
  }

  /** Shared export finaliser: enforce the row cap, audit the export, stream the CSV. */
  private async deliver(
    res: Response,
    user: RequestUser,
    reportType: string,
    result: ExportResult,
    filters: object,
  ): Promise<void> {
    if ("tooMany" in result) {
      throw new UnprocessableEntityException(
        `This export would include ${result.tooMany} rows, which exceeds the ${MAX_EXPORT_ROWS.toLocaleString()} row limit. Narrow the filters and try again.`,
      );
    }
    await this.audit.record({
      action: "report.exported",
      entityType: "Report",
      entityId: reportType,
      organizationId: user.activeOrganizationId ?? null,
      actorUserId: user.id,
      metadata: { reportType, rowCount: result.rowCount, filters: JSON.parse(JSON.stringify(filters)) },
    });
    const filename = csvFilename(reportType);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(result.csv);
  }
}
