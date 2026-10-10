import { after, type NextRequest } from "next/server";

import { alertsConfig, checkAlertsConfig } from "@/lib/alerts/config";
import { createResendMailer } from "@/lib/alerts/resend-mailer";
import { handleSignup, unavailableBody } from "@/lib/alerts/signup";
import { allowSignupAttempt, hashClientIp, supabaseAlertStore } from "@/lib/alerts/store-supabase";

export async function POST(request: NextRequest) {
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    raw = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const config = alertsConfig();
  const emailEnabled = checkAlertsConfig(config);
  const now = new Date();

  try {
    const result = await handleSignup(raw, {
      store: supabaseAlertStore,
      config,
      now,
      emailEnabled,
      allowAttempt: () => allowSignupAttempt(hashClientIp(request.headers), now),
    });

    // Send after responding, so the response is the same speed whether or not an email goes out.
    if (result.email && config.resendApiKey) {
      const mailer = createResendMailer(config.resendApiKey, config.fromEmail);
      const email = result.email;
      after(async () => {
        const sent = await mailer.send(email).catch((error: unknown) => ({ ok: false as const, error: String(error) }));
        if (!sent.ok) console.error(`[alerts] Confirmation email failed: ${sent.error}`);
      });
    }

    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error("[alerts] Sign-up failed:", error);
    return Response.json(unavailableBody, { status: 503 });
  }
}
