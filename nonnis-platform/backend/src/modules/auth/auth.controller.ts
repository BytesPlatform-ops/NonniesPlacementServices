import { Controller, Get } from "@nestjs/common";
import { CurrentAuth } from "./decorators";
import type { AuthState } from "./request-user";
import { AuthService, type MeResponse } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Authenticated user context. Requires a valid token; no specific permission. */
  @Get("me")
  me(@CurrentAuth() state: AuthState): MeResponse {
    return this.auth.buildMe(state);
  }
}
