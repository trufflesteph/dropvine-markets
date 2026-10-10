import assert from "node:assert/strict";
import { test } from "node:test";

import { confirmationEmail, newMarketEmail } from "../src/lib/alerts/emails.ts";
import { haversineMiles, matchSubscribers } from "../src/lib/alerts/geo.ts";
import { planMarketAlerts, resolveMarketLocation, sendMarketAlerts } from "../src/lib/alerts/send.ts";
import { acceptedBody, confirmationResendMinutes, handleSignup, type SignupContext } from "../src/lib/alerts/signup.ts";
import { confirmSubscription, confirmationValidDays, handleOneClickUnsubscribe, previewConfirmation, previewUnsubscribe, unsubscribe } from "../src/lib/alerts/subscriptions.ts";
import { isWellFormedToken, newToken } from "../src/lib/alerts/tokens.ts";
import type { AlertStore, EmailMessage, LocatedSubscriber, Mailer, NewSubscriber, Subscriber } from "../src/lib/alerts/types.ts";
import { isValidEmail, normalizeEmail, normalizeZip, parseRadius, validateSignup } from "../src/lib/alerts/validation.ts";

// ---------- Test doubles: no database, no Resend, no real email. ----------

const zips: Record<string, { latitude: number; longitude: number }> = {
  "97068": { latitude: 45.35176, longitude: -122.66902 }, // West Linn
  "97201": { latitude: 45.50759, longitude: -122.6905 }, // Portland
  "98101": { latitude: 47.61067, longitude: -122.33438 }, // Seattle
};

class MemoryStore implements AlertStore {
  subscribers: Subscriber[] = [];
  sends = new Set<string>();
  failures: { marketId: string; subscriberId: string; error: string }[] = [];
  private nextId = 1;
  async zipLocation(zip: string) { return zips[zip] ?? null; }
  async findSubscriber(email: string, zip: string) { return this.subscribers.find((s) => s.email === email && s.zip === zip) ?? null; }
  async insertSubscriber(row: NewSubscriber) {
    if (await this.findSubscriber(row.email, row.zip)) return null;
    const subscriber = { ...row, id: `sub-${this.nextId++}`, created_at: new Date().toISOString() };
    this.subscribers.push(subscriber);
    return { ...subscriber };
  }
  async updateSubscriber(id: string, patch: Partial<NewSubscriber>) { Object.assign(this.subscribers.find((s) => s.id === id)!, patch); }
  async findByConfirmToken(token: string) { return this.subscribers.find((s) => s.confirm_token === token) ?? null; }
  async findByUnsubscribeToken(token: string) { return this.subscribers.find((s) => s.unsubscribe_token === token) ?? null; }
  async listConfirmedSubscribers(): Promise<LocatedSubscriber[]> {
    return this.subscribers.filter((s) => s.status === "confirmed").map((s) => ({ id: s.id, email: s.email, zip: s.zip, radius_miles: s.radius_miles, unsubscribe_token: s.unsubscribe_token, ...zips[s.zip] }));
  }
  async sentSubscriberIds(marketId: string) { return new Set([...this.sends].filter((key) => key.startsWith(`${marketId}/`)).map((key) => key.split("/")[1])); }
  async claimSends(marketId: string, ids: string[]) {
    const claimed = new Set<string>();
    for (const id of ids) if (!this.sends.has(`${marketId}/${id}`)) { this.sends.add(`${marketId}/${id}`); claimed.add(id); }
    return claimed;
  }
  async releaseSend(marketId: string, subscriberId: string) { this.sends.delete(`${marketId}/${subscriberId}`); }
  async recordFailure(marketId: string, subscriberId: string, error: string) { this.failures.push({ marketId, subscriberId, error }); }
}

class FakeMailer implements Mailer {
  sent: EmailMessage[] = [];
  failFor = new Set<string>();
  async send(message: EmailMessage) {
    if (this.failFor.has(message.to)) return { ok: false as const, error: "mailbox unavailable" };
    this.sent.push(message);
    return { ok: true as const };
  }
}

const config = { siteUrl: "https://dropvinemarkets.com", mailingAddress: "123 Example St, West Linn, OR 97068" };
const minutes = (count: number) => count * 60 * 1000;

function context(store: MemoryStore, now: Date, overrides: Partial<SignupContext> = {}): SignupContext {
  return { store, config, now, emailEnabled: true, allowAttempt: async () => true, ...overrides };
}

async function confirmedSubscriber(store: MemoryStore, email: string, zip: string, radius: number) {
  const subscriber = (await store.insertSubscriber({
    email, zip, radius_miles: radius as Subscriber["radius_miles"], status: "confirmed", confirm_token: newToken(), unsubscribe_token: newToken(),
    confirmation_sent_at: null, confirmed_at: new Date().toISOString(), unsubscribed_at: null,
  }))!;
  return subscriber;
}

// ---------- Validation ----------

test("emails are trimmed, lowercased, and checked", () => {
  assert.equal(normalizeEmail("  Shopper@Example.COM "), "shopper@example.com");
  for (const email of ["a@b.co", "first.last+tag@sub.example.org"]) assert.ok(isValidEmail(email), email);
  for (const email of ["", "no-at-sign", "a@b", "a@.com", "a b@c.com", "a@b..com", `${"x".repeat(250)}@b.co`]) assert.ok(!isValidEmail(email), email);
});

test("ZIP codes must be 5 digits; ZIP+4 is reduced to 5", () => {
  assert.equal(normalizeZip(" 97068 "), "97068");
  assert.equal(normalizeZip("97068-1234"), "97068");
  for (const zip of ["9706", "970688", "abcde", "97 068", "", null]) assert.equal(normalizeZip(zip), null, String(zip));
});

test("radius must be one of the allowed values, defaulting to 25", () => {
  assert.equal(parseRadius("50"), 50);
  assert.equal(parseRadius(100), 100);
  for (const value of ["30", 0, "", "abc"]) assert.equal(parseRadius(value), null, String(value));
  assert.deepEqual(validateSignup({ email: "A@B.co", zip: "97068" }), { ok: true, value: { email: "a@b.co", zip: "97068", radius_miles: 25 } });
  assert.deepEqual(validateSignup({ email: "nope", zip: "123", radius: "7" }), {
    ok: false, errors: { email: "Enter a valid email address", zip: "Enter a valid 5-digit ZIP", radius: "Choose 10, 25, 50, or 100 miles" },
  });
});

// ---------- Distance and matching ----------

test("haversine distances are right", () => {
  assert.equal(haversineMiles(zips["97068"], zips["97068"]), 0);
  // Portland to Seattle is about 145 miles as the crow flies.
  const portlandSeattle = haversineMiles(zips["97201"], zips["98101"]);
  assert.ok(portlandSeattle > 140 && portlandSeattle < 150, String(portlandSeattle));
  // One degree of latitude is ~69.09 miles everywhere.
  assert.ok(Math.abs(haversineMiles({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }) - 69.093) < 0.01);
  // Symmetric, and fine across the antimeridian.
  assert.equal(haversineMiles(zips["97201"], zips["98101"]), haversineMiles(zips["98101"], zips["97201"]));
  assert.ok(haversineMiles({ latitude: 0, longitude: 179.9 }, { latitude: 0, longitude: -179.9 }) < 14);
});

test("subscribers match only within their own radius, inclusive at the edge", () => {
  const market = { latitude: 45, longitude: -122 };
  const milesPerDegree = (3958.8 * Math.PI) / 180; // Earth radius used by haversineMiles
  const at = (miles: number) => ({ latitude: 45 + miles / milesPerDegree, longitude: -122 });
  const subscribers = [
    { id: "exactly-10", radius_miles: 10, ...at(10) },
    { id: "just-past-10", radius_miles: 10, ...at(10.01) },
    { id: "30-away-radius-25", radius_miles: 25, ...at(30) },
    { id: "30-away-radius-50", radius_miles: 50, ...at(30) },
    { id: "same-spot", radius_miles: 10, ...at(0) },
  ];
  assert.deepEqual(matchSubscribers(market, subscribers).map((s) => s.id), ["exactly-10", "30-away-radius-50", "same-spot"]);
  assert.deepEqual(matchSubscribers(market, []), []);
});

test("a market is located by coordinates, else by its ZIP", async () => {
  const store = new MemoryStore();
  assert.deepEqual(await resolveMarketLocation(store, { latitude: 45.36, longitude: -122.61, zip: "97068" }), { latitude: 45.36, longitude: -122.61, source: "coordinates" });
  assert.deepEqual(await resolveMarketLocation(store, { latitude: null, longitude: null, zip: "97068" }), { ...zips["97068"], source: "zip" });
  assert.equal(await resolveMarketLocation(store, { latitude: null, longitude: null, zip: "00000" }), null);
  assert.equal(await resolveMarketLocation(store, { latitude: null, longitude: null, zip: null }), null);
});

// ---------- Sign-up ----------

test("the response is identical for new, pending, confirmed, and unsubscribed addresses", async () => {
  const store = new MemoryStore();
  const now = new Date("2026-10-09T18:00:00Z");
  const request = { email: "Someone@Example.com ", zip: "97068", radius: "25" };

  const fresh = await handleSignup(request, context(store, now));
  const pendingThrottled = await handleSignup(request, context(store, new Date(now.getTime() + minutes(1))));
  const pendingResent = await handleSignup(request, context(store, new Date(now.getTime() + minutes(10))));
  await store.updateSubscriber(store.subscribers[0].id, { status: "confirmed" });
  const confirmed = await handleSignup(request, context(store, new Date(now.getTime() + minutes(20))));
  await store.updateSubscriber(store.subscribers[0].id, { status: "unsubscribed" });
  const unsubscribed = await handleSignup(request, context(store, new Date(now.getTime() + minutes(30))));

  const results = [fresh, pendingThrottled, pendingResent, confirmed, unsubscribed];
  assert.deepEqual(results.map((r) => r.outcome), ["created", "throttled", "resent", "already-confirmed", "reactivated"]);
  for (const result of results) {
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, acceptedBody);
  }
  assert.deepEqual(results.map((r) => Boolean(r.email)), [true, false, true, false, true]);
  assert.equal(store.subscribers.length, 1);
  assert.equal(store.subscribers[0].email, "someone@example.com");
});

test("a pending address gets at most one confirmation email per few minutes", async () => {
  const store = new MemoryStore();
  const start = new Date("2026-10-09T18:00:00Z");
  const at = (offset: number) => context(store, new Date(start.getTime() + minutes(offset)));
  const body = { email: "a@b.co", zip: "97068" };
  assert.ok((await handleSignup(body, at(0))).email);
  assert.equal((await handleSignup(body, at(confirmationResendMinutes - 1))).email, undefined);
  assert.ok((await handleSignup(body, at(confirmationResendMinutes + 1))).email);
});

test("re-signing up after unsubscribing starts a new pending sign-up with new tokens", async () => {
  const store = new MemoryStore();
  await handleSignup({ email: "a@b.co", zip: "97068", radius: 10 }, context(store, new Date()));
  const before = { ...store.subscribers[0] };
  await store.updateSubscriber(before.id, { status: "unsubscribed", unsubscribed_at: new Date().toISOString() });
  const result = await handleSignup({ email: "a@b.co", zip: "97068", radius: 50 }, context(store, new Date()));
  const after = store.subscribers[0];
  assert.equal(result.outcome, "reactivated");
  assert.equal(after.status, "pending");
  assert.equal(after.radius_miles, 50);
  assert.equal(after.unsubscribed_at, null);
  assert.notEqual(after.confirm_token, before.confirm_token);
  assert.notEqual(after.unsubscribe_token, before.unsubscribe_token);
});

test("invalid input, unknown ZIPs, honeypots, rate limits, and missing email config", async () => {
  const store = new MemoryStore();
  const now = new Date();
  assert.deepEqual(await handleSignup({ email: "bad", zip: "97068" }, context(store, now)), { status: 400, body: { ok: false, errors: { email: "Enter a valid email address" } } });
  assert.deepEqual(await handleSignup({ email: "a@b.co", zip: "00000" }, context(store, now)), { status: 400, body: { ok: false, errors: { zip: "We don't recognize that ZIP code" } } });

  const honeypot = await handleSignup({ email: "a@b.co", zip: "97068", company: "Spam Inc" }, context(store, now));
  assert.deepEqual(honeypot, { status: 200, body: acceptedBody });
  assert.equal(store.subscribers.length, 0, "honeypot hits store nothing");

  assert.equal((await handleSignup({ email: "a@b.co", zip: "97068" }, context(store, now, { allowAttempt: async () => false }))).status, 429);
  assert.equal((await handleSignup({ email: "a@b.co", zip: "97068" }, context(store, now, { emailEnabled: false }))).status, 503);
  assert.equal(store.subscribers.length, 0);
});

// ---------- Tokens ----------

test("tokens are long, random, and URL-safe", () => {
  const tokens = new Set(Array.from({ length: 200 }, newToken));
  assert.equal(tokens.size, 200);
  for (const token of tokens) assert.ok(isWellFormedToken(token));
  assert.ok(!isWellFormedToken("short"));
  assert.ok(!isWellFormedToken(`${newToken()}'; drop table`));
});

test("confirm links: valid, reused, expired, unknown, malformed, and after unsubscribing", async () => {
  const store = new MemoryStore();
  const now = new Date("2026-10-09T18:00:00Z");
  await handleSignup({ email: "a@b.co", zip: "97068" }, context(store, now));
  const { confirm_token } = store.subscribers[0];

  assert.equal(await confirmSubscription(store, confirm_token, now), "confirmed");
  assert.equal(store.subscribers[0].status, "confirmed");
  assert.equal(await confirmSubscription(store, confirm_token, now), "already-confirmed");
  assert.equal(await confirmSubscription(store, newToken(), now), "invalid");
  assert.equal(await confirmSubscription(store, "not-a-token", now), "invalid");
  assert.equal(await confirmSubscription(store, undefined, now), "invalid");

  await handleSignup({ email: "late@b.co", zip: "97068" }, context(store, now));
  const late = store.subscribers[1];
  assert.equal(await confirmSubscription(store, late.confirm_token, new Date(now.getTime() + (confirmationValidDays + 1) * 86400000)), "expired");
  assert.equal(late.status, "pending");

  await unsubscribe(store, late.unsubscribe_token, now);
  assert.equal(await confirmSubscription(store, late.confirm_token, now), "unsubscribed");
  assert.equal(late.status, "unsubscribed", "an old confirm link can't re-subscribe");
});

test("unsubscribe links work once, then report already-unsubscribed", async () => {
  const store = new MemoryStore();
  const subscriber = await confirmedSubscriber(store, "a@b.co", "97068", 25);
  assert.equal(await unsubscribe(store, subscriber.unsubscribe_token, new Date()), "unsubscribed");
  assert.equal(store.subscribers[0].status, "unsubscribed");
  assert.ok(store.subscribers[0].unsubscribed_at);
  assert.equal(await unsubscribe(store, subscriber.unsubscribe_token, new Date()), "already-unsubscribed");
  assert.equal(await unsubscribe(store, newToken(), new Date()), "invalid");
  assert.equal(await unsubscribe(store, "", new Date()), "invalid");
});

// ---------- Link scanners: opening a link (GET) changes nothing; only a POST does ----------

test("opening a confirm link previews without confirming; the button POST confirms", async () => {
  const store = new MemoryStore();
  const now = new Date("2026-10-09T18:00:00Z");
  await handleSignup({ email: "a@b.co", zip: "97068", radius: 50 }, context(store, now));
  const subscriber = store.subscribers[0];
  const before = { ...subscriber };

  // A scanner opening the link several times.
  for (let index = 0; index < 3; index += 1) {
    assert.deepEqual(await previewConfirmation(store, subscriber.confirm_token, now), { state: "ready", zip: "97068", radius_miles: 50 });
  }
  assert.deepEqual(store.subscribers[0], before, "GET left the subscriber untouched");

  assert.equal(await confirmSubscription(store, subscriber.confirm_token, now), "confirmed");
  assert.equal(store.subscribers[0].status, "confirmed");
  assert.deepEqual(await previewConfirmation(store, subscriber.confirm_token, now), { state: "already-confirmed" });
});

test("opening an unsubscribe link previews without unsubscribing; the button POST unsubscribes", async () => {
  const store = new MemoryStore();
  const subscriber = await confirmedSubscriber(store, "a@b.co", "97068", 25);
  for (let index = 0; index < 3; index += 1) {
    assert.deepEqual(await previewUnsubscribe(store, subscriber.unsubscribe_token), { state: "ready", zip: "97068" });
  }
  assert.equal(store.subscribers[0].status, "confirmed", "GET left the subscriber subscribed");
  assert.equal(store.subscribers[0].unsubscribed_at, null);

  assert.equal(await unsubscribe(store, subscriber.unsubscribe_token, new Date()), "unsubscribed");
  assert.equal(store.subscribers[0].status, "unsubscribed");
  assert.deepEqual(await previewUnsubscribe(store, subscriber.unsubscribe_token), { state: "already-unsubscribed" });
});

test("bad, expired, and used links give the same answer on GET as on POST", async () => {
  const store = new MemoryStore();
  const now = new Date("2026-10-09T18:00:00Z");
  await handleSignup({ email: "late@b.co", zip: "97068" }, context(store, now));
  const late = store.subscribers[0];
  const later = new Date(now.getTime() + (confirmationValidDays + 1) * 86400000);
  const used = await confirmedSubscriber(store, "used@b.co", "97068", 25);
  await unsubscribe(store, used.unsubscribe_token, now);

  const confirmCases: [unknown, Date][] = [[undefined, now], ["not-a-token", now], [newToken(), now], [late.confirm_token, later], [used.confirm_token, now]];
  for (const [token, at] of confirmCases) {
    const preview = await previewConfirmation(store, token, at);
    assert.equal(preview.state, await confirmSubscription(store, token, at), String(token));
  }
  for (const token of [undefined, "short", newToken(), used.unsubscribe_token]) {
    assert.equal((await previewUnsubscribe(store, token)).state, await unsubscribe(store, token, now), String(token));
  }
  assert.equal(store.subscribers[0].status, "pending", "the expired sign-up was never confirmed");
});

test("mail clients' one-click POST unsubscribes immediately; GET and HEAD to that URL do nothing", async () => {
  const store = new MemoryStore();
  const subscriber = await confirmedSubscriber(store, "a@b.co", "97068", 25);
  const url = `https://dropvinemarkets.com/api/alerts/unsubscribe?token=${subscriber.unsubscribe_token}`;

  for (const method of ["GET", "HEAD"]) {
    const response = await handleOneClickUnsubscribe(new Request(url, { method }), store, new Date());
    assert.equal(response.status, 405, method);
    assert.equal(store.subscribers[0].status, "confirmed", `${method} changed nothing`);
  }

  const response = await handleOneClickUnsubscribe(
    new Request(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click" }),
    store,
    new Date(),
  );
  assert.equal(response.status, 200);
  assert.equal(store.subscribers[0].status, "unsubscribed");

  // Unknown tokens still get 200, revealing nothing.
  assert.equal((await handleOneClickUnsubscribe(new Request(url.replace(subscriber.unsubscribe_token, newToken()), { method: "POST" }), store, new Date())).status, 200);
});

// ---------- Sending ----------

const market = { id: "market-1", name: "West Linn Holiday Bazaar", slug: "west-linn-holiday-bazaar", city: "West Linn", state: "OR", dates: "Nov 14–15", vendorCount: 37 };
const instant = { sleep: async () => {}, pauseMs: 0 };

test("only confirmed subscribers in range are emailed, and never twice for the same market", async () => {
  const store = new MemoryStore();
  const mailer = new FakeMailer();
  await confirmedSubscriber(store, "near@b.co", "97201", 25); // ~11 miles away
  await confirmedSubscriber(store, "far@b.co", "98101", 100); // ~140 miles away
  await handleSignup({ email: "pending@b.co", zip: "97068" }, context(store, new Date())); // never confirmed

  const dryRun = await planMarketAlerts(store, market.id, zips["97068"]);
  assert.deepEqual(dryRun.recipients.map((r) => r.email), ["near@b.co"]);
  assert.equal(mailer.sent.length, 0, "dry run sends nothing");

  assert.deepEqual(await sendMarketAlerts(market, zips["97068"], { store, mailer, config, ...instant }), { sent: 1, failed: 0, skipped: 0 });
  assert.deepEqual(await sendMarketAlerts(market, zips["97068"], { store, mailer, config, ...instant }), { sent: 0, failed: 0, skipped: 1 });
  assert.deepEqual(mailer.sent.map((m) => m.to), ["near@b.co"]);
  assert.equal((await planMarketAlerts(store, market.id, zips["97068"])).recipients.length, 0);

  // A different market is a separate send.
  assert.equal((await sendMarketAlerts({ ...market, id: "market-2" }, zips["97068"], { store, mailer, config, ...instant })).sent, 1);
});

test("two concurrent sends for the same market email each subscriber once", async () => {
  const store = new MemoryStore();
  const mailer = new FakeMailer();
  for (let index = 0; index < 5; index += 1) await confirmedSubscriber(store, `s${index}@b.co`, "97068", 10);
  const [first, second] = await Promise.all([
    sendMarketAlerts(market, zips["97068"], { store, mailer, config, ...instant }),
    sendMarketAlerts(market, zips["97068"], { store, mailer, config, ...instant }),
  ]);
  assert.equal(first.sent + second.sent, 5);
  assert.equal(mailer.sent.length, 5);
  assert.equal(new Set(mailer.sent.map((m) => m.to)).size, 5);
});

test("failed sends are recorded, not marked sent, and retried next time", async () => {
  const store = new MemoryStore();
  const mailer = new FakeMailer();
  for (const email of ["ok1@b.co", "bounce@b.co", "ok2@b.co"]) await confirmedSubscriber(store, email, "97068", 25);
  mailer.failFor.add("bounce@b.co");

  assert.deepEqual(await sendMarketAlerts(market, zips["97068"], { store, mailer, config, batchSize: 2, ...instant }), { sent: 2, failed: 1, skipped: 0 });
  assert.equal(store.failures.length, 1);
  assert.equal(store.failures[0].error, "mailbox unavailable");
  assert.equal((await store.sentSubscriberIds(market.id)).size, 2);

  mailer.failFor.clear();
  assert.deepEqual(await sendMarketAlerts(market, zips["97068"], { store, mailer, config, ...instant }), { sent: 1, failed: 0, skipped: 2 });
  assert.deepEqual(mailer.sent.map((m) => m.to).sort(), ["bounce@b.co", "ok1@b.co", "ok2@b.co"]);
});

test("a mailer that throws counts as a failure, not a crash", async () => {
  const store = new MemoryStore();
  await confirmedSubscriber(store, "a@b.co", "97068", 25);
  const throwing: Mailer = { send: async () => { throw new Error("network down"); } };
  assert.deepEqual(await sendMarketAlerts(market, zips["97068"], { store, mailer: throwing, config, ...instant }), { sent: 0, failed: 1, skipped: 0 });
  assert.equal((await store.sentSubscriberIds(market.id)).size, 0);
});

test("batches are paced", async () => {
  const store = new MemoryStore();
  for (let index = 0; index < 5; index += 1) await confirmedSubscriber(store, `s${index}@b.co`, "97068", 25);
  const pauses: number[] = [];
  await sendMarketAlerts(market, zips["97068"], { store, mailer: new FakeMailer(), config, batchSize: 2, pauseMs: 1100, sleep: async (ms) => { pauses.push(ms); } });
  assert.deepEqual(pauses, [1100, 1100], "3 batches → 2 pauses");
});

// ---------- Emails ----------

test("every email has unsubscribe links, one-click headers, plain text, and the mailing address", () => {
  const subscriber = { id: "sub-1", email: "a@b.co", zip: "97068", radius_miles: 25, confirm_token: newToken(), unsubscribe_token: newToken() };
  const confirm = confirmationEmail(config, subscriber);
  const alert = newMarketEmail(config, { ...market, name: "Tom & Jerry's <Fair>" }, subscriber);

  assert.equal(confirm.subject, "Confirm your Dropvine Markets alerts");
  assert.ok(confirm.html.includes(`/alerts/confirm?token=${subscriber.confirm_token}`));
  assert.ok(confirm.text.includes("within 25 miles of 97068"));
  assert.ok(confirm.text.includes("If this wasn't you"));

  assert.equal(alert.subject, "New market near you: Tom & Jerry's <Fair>");
  assert.ok(alert.html.includes("Tom &amp; Jerry&#39;s &lt;Fair&gt;"), "names are HTML-escaped");
  assert.ok(alert.text.includes("Nov 14–15 · West Linn, OR · 37 vendors"));
  assert.ok(alert.text.includes("https://dropvinemarkets.com/markets/west-linn-holiday-bazaar"));
  assert.ok(alert.text.includes("You're receiving this because you asked for market alerts near 97068."));
  assert.equal(alert.idempotencyKey, "market-alert/market-1/sub-1");

  for (const email of [confirm, alert]) {
    assert.ok(email.html.includes(`/alerts/unsubscribe?token=${subscriber.unsubscribe_token}`));
    assert.ok(email.text.includes(`/alerts/unsubscribe?token=${subscriber.unsubscribe_token}`));
    assert.equal(email.headers["List-Unsubscribe"], `<https://dropvinemarkets.com/api/alerts/unsubscribe?token=${subscriber.unsubscribe_token}>`);
    assert.equal(email.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    assert.ok(email.text.includes("123 Example St, West Linn, OR 97068"));
    assert.ok(!email.html.includes("<table"), "table-free HTML");
  }

  const noAddress = confirmationEmail({ ...config, mailingAddress: null }, subscriber);
  assert.ok(noAddress.text.includes("[Mailing address: set ALERTS_MAILING_ADDRESS]"));
});
