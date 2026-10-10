import { isWellFormedToken } from "./tokens.ts";
import type { AlertStore } from "./types.ts";

/** A confirmation link works for this long after the most recent confirmation email. */
export const confirmationValidDays = 7;

// Links in emails get opened by link scanners and prefetchers, so opening one (GET) only *previews* what will
// happen; the change itself needs a POST (the button on the page, or a mail client's one-click unsubscribe).

export type ConfirmResult = "confirmed" | "already-confirmed" | "expired" | "unsubscribed" | "invalid";
export type ConfirmPreview = { state: "ready"; zip: string; radius_miles: number } | { state: Exclude<ConfirmResult, "confirmed"> };

async function checkConfirmToken(store: AlertStore, token: unknown, now: Date) {
  if (!isWellFormedToken(token)) return { state: "invalid" as const };
  const subscriber = await store.findByConfirmToken(token);
  if (!subscriber) return { state: "invalid" as const };
  if (subscriber.status === "confirmed") return { state: "already-confirmed" as const };
  // A link from before they unsubscribed must not quietly re-subscribe them.
  if (subscriber.status === "unsubscribed") return { state: "unsubscribed" as const };
  const sentAt = subscriber.confirmation_sent_at ?? subscriber.created_at;
  if (now.getTime() - new Date(sentAt).getTime() > confirmationValidDays * 24 * 60 * 60 * 1000) return { state: "expired" as const };
  return { state: "ready" as const, subscriber };
}

/** Read-only: what pressing "Confirm my alerts" would do. Never changes anything. */
export async function previewConfirmation(store: AlertStore, token: unknown, now: Date): Promise<ConfirmPreview> {
  const check = await checkConfirmToken(store, token, now);
  return check.state === "ready" ? { state: "ready", zip: check.subscriber.zip, radius_miles: check.subscriber.radius_miles } : check;
}

/** POST only. */
export async function confirmSubscription(store: AlertStore, token: unknown, now: Date): Promise<ConfirmResult> {
  const check = await checkConfirmToken(store, token, now);
  if (check.state !== "ready") return check.state;
  await store.updateSubscriber(check.subscriber.id, { status: "confirmed", confirmed_at: now.toISOString() });
  return "confirmed";
}

export type UnsubscribeResult = "unsubscribed" | "already-unsubscribed" | "invalid";
export type UnsubscribePreview = { state: "ready"; zip: string } | { state: Exclude<UnsubscribeResult, "unsubscribed"> };

async function checkUnsubscribeToken(store: AlertStore, token: unknown) {
  if (!isWellFormedToken(token)) return { state: "invalid" as const };
  const subscriber = await store.findByUnsubscribeToken(token);
  if (!subscriber) return { state: "invalid" as const };
  if (subscriber.status === "unsubscribed") return { state: "already-unsubscribed" as const };
  return { state: "ready" as const, subscriber };
}

/** Read-only: what pressing "Unsubscribe" would do. Never changes anything. */
export async function previewUnsubscribe(store: AlertStore, token: unknown): Promise<UnsubscribePreview> {
  const check = await checkUnsubscribeToken(store, token);
  return check.state === "ready" ? { state: "ready", zip: check.subscriber.zip } : check;
}

/** POST only. */
export async function unsubscribe(store: AlertStore, token: unknown, now: Date): Promise<UnsubscribeResult> {
  const check = await checkUnsubscribeToken(store, token);
  if (check.state !== "ready") return check.state;
  await store.updateSubscriber(check.subscriber.id, { status: "unsubscribed", unsubscribed_at: now.toISOString() });
  return "unsubscribed";
}

// RFC 8058 one-click unsubscribe, for mail clients' built-in button. Only a POST acts; anything else
// (GET, HEAD, prefetch) changes nothing. The route sends browsers that open the URL to the normal page instead.
export async function handleOneClickUnsubscribe(request: Request, store: AlertStore, now: Date): Promise<Response> {
  const headers = { "Content-Type": "text/plain; charset=utf-8" };
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { ...headers, Allow: "POST" } });
  await unsubscribe(store, new URL(request.url).searchParams.get("token"), now);
  // 200 for unknown tokens too: mail clients don't retry, and the result reveals nothing.
  return new Response("Unsubscribed.", { status: 200, headers });
}
