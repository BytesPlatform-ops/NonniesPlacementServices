import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { SKIP_TRANSFORM_KEY } from "../decorators/skip-transform.decorator";
import type { ApiSuccess } from "../types/api-response";

/**
 * Wraps every successful handler payload in a normalized `{ data }` envelope,
 * unless the handler opts out with @SkipTransform (e.g. the health endpoint).
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T> | T> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      return next.handle();
    }

    return next.handle().pipe(map((data) => ({ data })));
  }
}
