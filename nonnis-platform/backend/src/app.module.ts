import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { loadConfiguration } from "./config/configuration";
import { PrismaModule } from "./database/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CasesModule } from "./modules/cases/cases.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { FacilitiesModule } from "./modules/facilities/facilities.module";
import { FormSubmissionsModule } from "./modules/form-submissions/form-submissions.module";
import { HealthModule } from "./modules/health/health.module";
import { OperationsModule } from "./modules/operations/operations.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { ProviderPortalModule } from "./modules/provider-portal/provider-portal.module";
import { ReadinessModule } from "./modules/readiness/readiness.module";
import { ReferralsModule } from "./modules/referrals/referrals.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { TimelineModule } from "./modules/timeline/timeline.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfiguration] }),
    PrismaModule,
    AuthModule,
    HealthModule,
    CasesModule,
    DashboardModule,
    OrganizationsModule,
    FacilitiesModule,
    UsersModule,
    CatalogModule,
    ProvidersModule,
    ProviderPortalModule,
    OperationsModule,
    FormSubmissionsModule,
    ReferralsModule,
    ReadinessModule,
    TasksModule,
    MessagesModule,
    TimelineModule,
  ],
})
export class AppModule {}
