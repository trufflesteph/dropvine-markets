import { confirmationEmail } from "./emails.ts";
import { newToken } from "./tokens.ts";
import type { AlertStore, AlertsConfig, EmailMessage, Subscriber } from "./types.ts";
import { errorMessages, type FieldErrors, type SignupValues, validateSignup } from "./validation.ts";

/** A pending address gets at most one confirmation email per this many minutes. */
export const confirmationResendMinutes = 5;

export type SignupOutcome = "created" | "resent" | "reactivated" | "throttled" | "already-confirmed";

type ResponseBody = { ok: true } | { ok: false; errors?: FieldErrors; error?: string };
export type SignupResponse = { status: number; body: ResponseBody; email?: EmailMessage; outcome?: SignupOutcome };

// Every accepted request gets exactly this, whether the address is new, pending, confirmed, or unsubscribed,
// so the form can't be used to find out who is subscribed.
export const acceptedBody: ResponseBody = { ok: true };
export const unavailableBody: ResponseBody = { ok: false, error: "Market alerts are temporarily unavailable. Please try again later." };
export const rateLimitedBody: ResponseBody = { ok: false, error: "Too many sign-up attempts. Please wait a few minutes and try again." };

const minutesBetween = (earlier: string | null, now: Date) => (earlier ? (now.getTime() - new Date(earlier).getTime()) / 60000 : Infinity);

function pendingFields(values: SignupValues, now: Date) {
  return {
    radius_miles: values.radius_miles,
    status: "pending" as const,
    confirm_token: newToken(),
    unsubscribe_token: newToken(),
    confirmation_sent_at: now.toISOString(),
    confirmed_at: null,
    unsubscribed_at: null,
  };
}

// Creates or updates the subscriber row and says whether a confirmation email should go out.
export async function registerSubscriber(store: AlertStore, values: SignupValues, now: Date, retried = false): Promise<{ outcome: SignupOutcome; subscriber?: Subscriber }> {
  const existing = await store.findSubscriber(values.email, values.zip);

  if (!existing) {
    const created = await store.insertSubscriber({ email: values.email, zip: values.zip, ...pendingFields(values, now) });
    // A concurrent request created the row first; handle it as an existing sign-up.
    if (!created) return retried ? { outcome: "throttled" } : registerSubscriber(store, values, now, true);
    return { outcome: "created", subscriber: created };
  }

  if (existing.status === "confirmed") return { outcome: "already-confirmed" };

  if (existing.status === "unsubscribed") {
    const fields = pendingFields(values, now);
    await store.updateSubscriber(existing.id, fields);
    return { outcome: "reactivated", subscriber: { ...existing, ...fields } };
  }

  if (minutesBetween(existing.confirmation_sent_at, now) < confirmationResendMinutes) return { outcome: "throttled" };

  // Still pending: resend the same link (it stays valid) and refresh its expiry. Update the radius to the latest choice.
  const patch = { radius_miles: values.radius_miles, confirmation_sent_at: now.toISOString() };
  await store.updateSubscriber(existing.id, patch);
  return { outcome: "resent", subscriber: { ...existing, ...patch } };
}

export type SignupContext = {
  store: AlertStore;
  config: AlertsConfig;
  now: Date;
  /** False when RESEND_API_KEY is missing; the caller logs why. */
  emailEnabled: boolean;
  /** Records this attempt and returns false if the client is over its limit. */
  allowAttempt: () => Promise<boolean>;
};

export async function handleSignup(raw: Record<string, unknown>, context: SignupContext): Promise<SignupResponse> {
  if (!context.emailEnabled) return { status: 503, body: unavailableBody };
  if (!(await context.allowAttempt())) return { status: 429, body: rateLimitedBody };

  // Honeypot: real people never see or fill this field. Pretend it worked.
  if (typeof raw.company === "string" && raw.company.trim()) return { status: 200, body: acceptedBody };

  const parsed = validateSignup(raw);
  if (!parsed.ok) return { status: 400, body: { ok: false, errors: parsed.errors } };
  if (!(await context.store.zipLocation(parsed.value.zip))) return { status: 400, body: { ok: false, errors: { zip: errorMessages.unknownZip } } };

  const { outcome, subscriber } = await registerSubscriber(context.store, parsed.value, context.now);
  return { status: 200, body: acceptedBody, outcome, email: subscriber ? confirmationEmail(context.config, subscriber) : undefined };
}
