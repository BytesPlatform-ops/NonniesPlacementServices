import "reflect-metadata";
import { json, urlencoded } from "express";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory, Reflector } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import type { AppConfig } from "./config/configuration";

async function bootstrap(): Promise<void> {
  // Body parsing is registered per route below so one giant application-wide
  // allowance is never applied to public provider webhooks.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(ConfigService<AppConfig, true>);

  // Route-scoped body limits, most specific first. body-parser marks a request once
  // parsed, so later (broader) parsers skip it — the first match wins.
  //
  // Contact imports post their (bounded ≤5 MB) file text as JSON.
  app.use("/api/v1/communications/imports", json({ limit: "6mb" }));
  // Provider webhooks are public: keep them tightly bounded.
  app.use("/api/v1/webhooks/communications/sms", urlencoded({ extended: false, limit: "128kb" }));
  app.use("/api/v1/webhooks/communications/email", json({ limit: "1mb" }));
  app.use("/api/v1/communications/email/webhook", json({ limit: "512kb" }));
  // Ordinary authenticated CRM traffic.
  app.use(json({ limit: "2mb" }));
  app.use(urlencoded({ extended: true, limit: "2mb" }));

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
