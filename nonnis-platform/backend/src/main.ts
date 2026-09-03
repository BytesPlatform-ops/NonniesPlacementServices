import "reflect-metadata";
import { json, urlencoded } from "express";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory, Reflector } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { loadConfiguration, type AppConfig } from "./config/configuration";
import { assertProductionConfig } from "./config/validate-config";

async function bootstrap(): Promise<void> {
  // Body parsing is registered per route below so one giant application-wide
  // allowance is never applied to public provider webhooks.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get(ConfigService<AppConfig, true>);

  // Refuse to serve traffic with unsafe production configuration (localhost
  // unsubscribe links, mock reply domains, missing secrets). No-op elsewhere.
  assertProductionConfig(loadConfiguration());

  // Route-scoped body limits, most specific first. body-parser marks a request once
  // parsed, so later (broader) parsers skip it — the first match wins.
  //
  // Contact imports post their (bounded ≤5 MB) file text as JSON.
  app.use("/api/v1/communications/imports", json({ limit: "6mb" }));
  // Website submissions carry the generated PDF plus any uploads, base64-encoded.
  // Kept deliberately modest: serverless platforms cap request bodies well below
  // this, and the website only forwards what fits its own budget.
  app.use("/api/v1/form-submissions/ingest", json({ limit: "4mb" }));
  // Provider webhooks are public: keep them tightly bounded.
  app.use("/api/v1/webhooks/communications/sms", urlencoded({ extended: false, limit: "128kb" }));
  app.use("/api/v1/webhooks/communications/email", json({ limit: "1mb" }));
  app.use("/api/v1/communications/email/webhook", json({ limit: "512kb" }));
  // Ordinary authenticated CRM traffic.
  app.use(json({ limit: "2mb" }));
  app.use(urlencoded({ extended: true, limit: "2mb" }));

  // Baseline response hardening. The API serves JSON only: it is never framed,
  // never sniffed, and must not advertise its stack.
  app.disable("x-powered-by");
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    next();
  });

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
