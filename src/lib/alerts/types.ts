import type { LatLng } from "./geo.ts";
import type { RadiusMiles } from "./validation.ts";

export type SubscriberStatus = "pending" | "confirmed" | "unsubscribed";

export type Subscriber = {
  id: string;
  email: string;
  zip: string;
  radius_miles: RadiusMiles;
  status: SubscriberStatus;
  confirm_token: string;
  unsubscribe_token: string;
  created_at: string;
  confirmation_sent_at: string | null;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
};

export type NewSubscriber = Omit<Subscriber, "id" | "created_at">;

/** A confirmed subscriber with their ZIP's coordinates, as used for matching. */
export type LocatedSubscriber = Pick<Subscriber, "id" | "email" | "zip" | "radius_miles" | "unsubscribe_token"> & LatLng;

// Everything the alert logic needs from the database. Implemented with Supabase in store-supabase.ts
// and with an in-memory fake in the tests.
export interface AlertStore {
  zipLocation(zip: string): Promise<LatLng | null>;
  findSubscriber(email: string, zip: string): Promise<Subscriber | null>;
  /** Returns null if (email, zip) already exists, e.g. a concurrent sign-up won the race. */
  insertSubscriber(row: NewSubscriber): Promise<Subscriber | null>;
  updateSubscriber(id: string, patch: Partial<NewSubscriber>): Promise<void>;
  findByConfirmToken(token: string): Promise<Subscriber | null>;
  findByUnsubscribeToken(token: string): Promise<Subscriber | null>;
  listConfirmedSubscribers(): Promise<LocatedSubscriber[]>;
  sentSubscriberIds(marketId: string): Promise<Set<string>>;
  /** Inserts alert_sends rows, ignoring ones that already exist; returns the subscriber ids actually claimed. */
  claimSends(marketId: string, subscriberIds: string[]): Promise<Set<string>>;
  releaseSend(marketId: string, subscriberId: string): Promise<void>;
  recordFailure(marketId: string, subscriberId: string, error: string): Promise<void>;
}

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  /** Passed to the provider so a retried request can't produce a second email. */
  idempotencyKey?: string;
};

export type SendResult = { ok: true } | { ok: false; error: string };

export interface Mailer {
  send(message: EmailMessage): Promise<SendResult>;
}

export type AlertsConfig = {
  siteUrl: string;
  mailingAddress: string | null;
};
