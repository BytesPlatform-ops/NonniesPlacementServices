import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthContextService } from "./auth-context.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { PermissionsGuard } from "./permissions.guard";
import { SupabaseService } from "./supabase.service";
import { TOKEN_VERIFIER } from "./token-verifier";

/**
 * Global authentication/authorization module. Registers the global AuthGuard
 * (authentication + context) and PermissionsGuard (authorization), in that
 * order, so every route is protected by default unless marked @Public().
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    SupabaseService,
    { provide: TOKEN_VERIFIER, useExisting: SupabaseService },
    AuthContextService,
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [SupabaseService, AuthContextService],
})
export class AuthModule {}
