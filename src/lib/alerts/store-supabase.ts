import { createHmac } from "node:crypto";

import { supabaseAdminFetch } from "@/lib/supabase-admin";
import type { AlertStore, LocatedSubscriber, NewSubscriber, Subscriber } from "./types.ts";

// All alert tables are private (RLS on, no grants), so everything here goes through the service-role key.

const pageSize = 1000;
const eq = (value: string) => `eq.${encodeURIComponent(value)}`;

async function request(path: string, init: RequestInit = {}) {
  const response = await supabaseAdminFetch(path, init);
  if (!response.ok) throw new Error(`[alerts] Supabase ${init.method ?? "GET"} ${path.split("?")[0]} failed: ${response.status} ${await response.text()}`);
  return response;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  return (await request(path, init)).json() as Promise<T>;
}

// PostgREST caps responses (1000 rows by default), so page through large lists.
async function fetchAll<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await json<T[]>(`${path}&limit=${pageSize}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

const body = (value: unknown, method: string, prefer: string): RequestInit => ({ method, headers: { Prefer: prefer }, body: JSON.stringify(value) });

export const supabaseAlertStore: AlertStore = {
  async zipLocation(zip) {
    const rows = await json<{ latitude: number; longitude: number }[]>(`zip_codes?zip=${eq(zip)}&select=latitude,longitude`);
    return rows[0] ?? null;
  },
  async findSubscriber(email, zip) {
    return (await json<Subscriber[]>(`alert_subscribers?email=${eq(email)}&zip=${eq(zip)}&select=*`))[0] ?? null;
  },
  async insertSubscriber(row: NewSubscriber) {
    const response = await supabaseAdminFetch("alert_subscribers?select=*", body(row, "POST", "return=representation"));
    if (response.status === 409) return null;
    if (!response.ok) throw new Error(`[alerts] Supabase insert alert_subscribers failed: ${response.status} ${await response.text()}`);
    return ((await response.json()) as Subscriber[])[0] ?? null;
  },
  async updateSubscriber(id, patch) {
    await request(`alert_subscribers?id=${eq(id)}`, body(patch, "PATCH", "return=minimal"));
  },
  async findByConfirmToken(token) {
    return (await json<Subscriber[]>(`alert_subscribers?confirm_token=${eq(token)}&select=*`))[0] ?? null;
  },
  async findByUnsubscribeToken(token) {
    return (await json<Subscriber[]>(`alert_subscribers?unsubscribe_token=${eq(token)}&select=*`))[0] ?? null;
  },
  async listConfirmedSubscribers() {
    type Row = Omit<LocatedSubscriber, "latitude" | "longitude"> & { zip_codes: { latitude: number; longitude: number } | null };
    const rows = await fetchAll<Row>("alert_subscribers?status=eq.confirmed&select=id,email,zip,radius_miles,unsubscribe_token,zip_codes(latitude,longitude)&order=id.asc");
    return rows.flatMap(({ zip_codes, ...subscriber }) => (zip_codes ? [{ ...subscriber, ...zip_codes }] : []));
  },
  async sentSubscriberIds(marketId) {
    const rows = await fetchAll<{ subscriber_id: string }>(`alert_sends?market_id=${eq(marketId)}&select=subscriber_id&order=subscriber_id.asc`);
    return new Set(rows.map((row) => row.subscriber_id));
  },
  async claimSends(marketId, subscriberIds) {
    if (!subscriberIds.length) return new Set();
    // ignore-duplicates: rows that already exist are skipped and not returned, so only fresh claims come back.
    const rows = await json<{ subscriber_id: string }[]>(
      "alert_sends?on_conflict=subscriber_id,market_id&select=subscriber_id",
      body(subscriberIds.map((subscriber_id) => ({ subscriber_id, market_id: marketId })), "POST", "resolution=ignore-duplicates,return=representation"),
    );
    return new Set(rows.map((row) => row.subscriber_id));
  },
  async releaseSend(marketId, subscriberId) {
    await request(`alert_sends?market_id=${eq(marketId)}&subscriber_id=${eq(subscriberId)}`, { method: "DELETE" });
  },
  async recordFailure(marketId, subscriberId, error) {
    await request("alert_send_failures", body({ market_id: marketId, subscriber_id: subscriberId, error }, "POST", "return=minimal"));
  },
};

export async function countConfirmedSubscribers() {
  const response = await request("alert_subscribers?status=eq.confirmed&select=id&limit=1", { headers: { Prefer: "count=exact" } });
  return Number(response.headers.get("content-range")?.split("/")[1] ?? 0);
}

// Rate limit: at most this many sign-up attempts per hashed IP per window. Stored in the database so it
// holds across serverless instances.
export const signupAttemptLimit = 5;
export const signupAttemptWindowMinutes = 10;

export function hashClientIp(headers: Headers) {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
  // Keyed hash so stored values can't be reversed by hashing every IPv4 address.
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update(ip).digest("base64url");
}

export async function allowSignupAttempt(ipHash: string, now: Date) {
  try {
    await request("alert_signup_attempts", body({ ip_hash: ipHash }, "POST", "return=minimal"));
    const since = new Date(now.getTime() - signupAttemptWindowMinutes * 60000).toISOString();
    const response = await request(`alert_signup_attempts?ip_hash=${eq(ipHash)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`, { headers: { Prefer: "count=exact" } });
    const attempts = Number(response.headers.get("content-range")?.split("/")[1] ?? 0);
    // Housekeeping: drop attempts older than a day. Failure here doesn't matter.
    void supabaseAdminFetch(`alert_signup_attempts?created_at=lt.${encodeURIComponent(new Date(now.getTime() - 86400000).toISOString())}`, { method: "DELETE" }).catch(() => {});
    return attempts <= signupAttemptLimit;
  } catch (error) {
    // Fail open: a rate-limit outage shouldn't block real sign-ups. Validation and double opt-in still apply.
    console.error("[alerts] Rate limit check failed; allowing the attempt.", error);
    return true;
  }
}
