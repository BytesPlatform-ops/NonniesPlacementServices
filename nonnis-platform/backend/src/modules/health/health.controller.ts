import { Controller, Get } from "@nestjs/common";
import { SkipTransform } from "../../common/decorators/skip-transform.decorator";
import { Public } from "../auth/decorators";

/** Liveness endpoint. Deliberately does not touch the database. */
@Controller("health")
export class HealthController {
  @Get()
  @Public()
  @SkipTransform()
  check(): { status: string; service: string; timestamp: string; uptime: number } {
    return {
      status: "ok",
      service: "nonnis-platform-backend",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
