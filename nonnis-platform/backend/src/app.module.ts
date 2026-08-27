import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { loadConfiguration } from "./config/configuration";
import { PrismaModule } from "./database/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CasesModule } from "./modules/cases/cases.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { FacilitiesModule } from "./modules/facilities/facilities.module";
import { HealthModule } from "./modules/health/health.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
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
  ],
})
export class AppModule {}
