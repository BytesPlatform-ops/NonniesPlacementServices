import { Controller, Get } from "@nestjs/common";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { DashboardService, type DischargeDashboard } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("discharge-professional")
  @RequirePermissions(PERMISSIONS.CASES_READ)
  dischargeProfessional(@CurrentUser() user: RequestUser): Promise<DischargeDashboard> {
    return this.dashboard.dischargeProfessional(user);
  }
}
