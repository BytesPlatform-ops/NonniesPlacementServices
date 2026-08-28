import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { OperationsController } from "./operations.controller";
import { OperationsService } from "./operations.service";

@Module({
  imports: [ProvidersModule],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
