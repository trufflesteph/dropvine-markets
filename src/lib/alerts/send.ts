import { type AlertMarket, newMarketEmail } from "./emails.ts";
import { type LatLng, matchSubscribers } from "./geo.ts";
import type { AlertStore, AlertsConfig, LocatedSubscriber, Mailer } from "./types.ts";

export type MarketLocation = LatLng & { source: "coordinates" | "zip" };

// Coordinates when the market has them, otherwise its ZIP's centroid; null if neither is available.
export async function resolveMarketLocation(
  store: Pick<AlertStore, "zipLocation">,
  market: { latitude: number | null; longitude: number | null; zip: string | null },
): Promise<MarketLocation | null> {
  if (market.latitude !== null && market.longitude !== null && Number.isFinite(market.latitude) && Number.isFinite(market.longitude)) {
    return { latitude: Number(market.latitude), longitude: Number(market.longitude), source: "coordinates" };
  }
  if (market.zip) {
    const location = await store.zipLocation(market.zip);
    if (location) return { ...location, source: "zip" };
  }
  return null;
}

export type AlertPlan = { recipients: LocatedSubscriber[]; alreadySent: number };

// Dry run: confirmed subscribers within their own radius who haven't been emailed about this market yet.
export async function planMarketAlerts(store: AlertStore, marketId: string, location: LatLng): Promise<AlertPlan> {
  const [subscribers, sent] = await Promise.all([store.listConfirmedSubscribers(), store.sentSubscriberIds(marketId)]);
  const matched = matchSubscribers(location, subscribers);
  const recipients = matched.filter((subscriber) => !sent.has(subscriber.id));
  return { recipients, alreadySent: matched.length - recipients.length };
}

export type SendSummary = { sent: number; failed: number; skipped: number };

export type SendOptions = {
  store: AlertStore;
  mailer: Mailer;
  config: AlertsConfig;
  /** Emails sent concurrently per batch. Resend's default limit is 2 requests per second. */
  batchSize?: number;
  /** Pause between batches. */
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Each recipient is claimed in alert_sends *before* their email is sent, so a second click or a concurrent run
// skips them. A failed send releases the claim and is logged, so it's retried next time and never counted as sent.
export async function sendMarketAlerts(market: AlertMarket, location: LatLng, options: SendOptions): Promise<SendSummary> {
  const { store, mailer, config, batchSize = 2, pauseMs = 1100, sleep = defaultSleep } = options;
  const plan = await planMarketAlerts(store, market.id, location);
  const summary: SendSummary = { sent: 0, failed: 0, skipped: plan.alreadySent };

  for (let index = 0; index < plan.recipients.length; index += batchSize) {
    if (index > 0) await sleep(pauseMs);
    const batch = plan.recipients.slice(index, index + batchSize);
    const claimed = await store.claimSends(market.id, batch.map((subscriber) => subscriber.id));
    summary.skipped += batch.length - claimed.size;

    await Promise.all(batch.filter((subscriber) => claimed.has(subscriber.id)).map(async (subscriber) => {
      let error: string | null;
      try {
        const result = await mailer.send(newMarketEmail(config, market, subscriber));
        error = result.ok ? null : result.error;
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }
      if (!error) {
        summary.sent += 1;
        return;
      }
      summary.failed += 1;
      await store.releaseSend(market.id, subscriber.id);
      await store.recordFailure(market.id, subscriber.id, error.slice(0, 500));
    }));
  }

  return summary;
}
