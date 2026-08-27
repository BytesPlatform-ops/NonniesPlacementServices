import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { loadConfiguration } from "./config/configuration";
import { PrismaModule } from "./database/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CasesModule } from "./modules/cases/cases.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfiguration] }),
    PrismaModule,
    AuthModule,
    HealthModule,
    CasesModule,
  ],
})
export class AppModule {}
