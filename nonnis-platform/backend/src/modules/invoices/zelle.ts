import type { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../config/configuration";

/**
 * Paying Nonni's by Zelle.
 *
 * One definition, used by the provider's screen, the invoice email and the PDF,
 * so the three can never disagree about who the money should go to. Getting
 * that wrong sends real money to the wrong account, which is why it is a
 * constant here rather than three strings written out in three places.
 *
 * The QR is the same image the marketplace already shows, because it is the
 * same account: Nonni's Placement Services LLC.
 */
export const ZELLE_RECIPIENT = "Nonni's Placement Services LLC";

/** Where the QR image is served from. It is a static file, public by design. */
export const ZELLE_QR_PATH = "/51094.jpg";

export interface ZelleInstructions {
  recipient: string;
  /** Absolute, because an email is read far away from the app that serves it. */
  qrUrl: string;
}

export function zelleInstructions(config: ConfigService<AppConfig, true>): ZelleInstructions {
  const base = config.get("frontendUrl", { infer: true }).replace(/\/$/, "");
  return { recipient: ZELLE_RECIPIENT, qrUrl: `${base}${ZELLE_QR_PATH}` };
}
