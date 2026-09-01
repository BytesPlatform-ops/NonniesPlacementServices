import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory, Reflector } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import type { AppConfig } from "./config/configuration";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<AppConfig, true>);

  // Versioned API routing; health stays unprefixed for infra checks.
  app.setGlobalPrefix("api/v1", { exclude: ["health"] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

  app.enableCors({
    origin: [config.get("frontendUrl", { infer: true })],
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  });
  app.enableShutdownHooks();

  const port = config.get("port", { infer: true });
  await app.listen(port);
  new Logger("Bootstrap").log(`Nonnis Platform API listening on http://localhost:${port} (api/v1)`);
}

void bootstrap();
