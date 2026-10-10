import { siteUrl } from "../site-url.ts";
import type { AlertsConfig } from "./types.ts";

export type ServerAlertsConfig = AlertsConfig & { resendApiKey: string | null; fromEmail: string };

export function alertsConfig(): ServerAlertsConfig {
  return {
    siteUrl,
    mailingAddress: process.env.ALERTS_MAILING_ADDRESS?.trim() || null,
    resendApiKey: process.env.RESEND_API_KEY?.trim() || null,
    fromEmail: process.env.ALERTS_FROM_EMAIL?.trim() || "Dropvine Markets <alerts@dropvinemarkets.com>",
  };
}

// Server-side log lines that say exactly what's missing. Returns false if email can't be sent at all.
export function checkAlertsConfig(config: ServerAlertsConfig) {
  if (!config.resendApiKey) {
    console.error("[alerts] RESEND_API_KEY is not set, so market alert emails can't be sent. Sign-ups are returning 503 until it is configured.");
    return false;
  }
  if (!config.mailingAddress) {
    console.warn("[alerts] ALERTS_MAILING_ADDRESS is not set; emails show a placeholder address. CAN-SPAM requires a real postal address.");
  }
  return true;
}
