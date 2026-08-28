import { Controller, Get } from "@nestjs/common";
import { PERMISSIONS } from "../../common/rbac";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { RequestUser } from "../auth/request-user";
import { ProviderPortalService, type ProviderPortalMe } from "./provider-portal.service";

@Controller("provider-portal")
export class ProviderPortalController {
  constructor(private readonly portal: ProviderPortalService) {}

  /** Resolve the caller's own provider (from active org) plus dashboard data. */
  @Get("me")
  @RequirePermissions(PERMISSIONS.PROVIDERS_READ)
  me(@CurrentUser() user: RequestUser): Promise<ProviderPortalMe> {
    return this.portal.me(user);
  }
}
