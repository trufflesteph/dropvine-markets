import type { Metadata } from "next";
import Image from "next/image";

import StallPlaceholder from "@/components/stall-placeholder";
import { focusRingClass, primaryButtonClass } from "@/components/styles";
import { formatDateRange, formatPlace, todayInLosAngeles } from "@/lib/market-format";
import { supabasePublicFetch } from "@/lib/supabase-public";
import MarketGrid, { type GridMarket } from "./market-grid";

type Market = {
  id: string;
  name: string;
  slug: string;
  market_type: string;
  city: string;
  state: string;
  hero_image_url: string | null;
  market_vendor_links: { count: number }[];
};

type MarketDate = {
  market_id: string;
  date: string;
};

type MarketPhoto = {
  market_id: string;
  photo_url: string;
  sort_order: number;
};

export async function generateMetadata(): Promise<Metadata> {
  const response = await supabasePublicFetch("markets?status=eq.published&select=hero_image_url&hero_image_url=not.is.null&order=name.asc");
  const markets = response.ok ? (await response.json()) as Pick<Market, "hero_image_url">[] : [];
  const images = markets.flatMap((market) => market.hero_image_url ? [{ url: market.hero_image_url }] : []);

  return {
    title: "Markets | Dropvine",
    description: "Find local markets worth wandering through.",
    openGraph: {
      title: "Markets | Dropvine",
      description: "Find local markets worth wandering through.",
      type: "website",
      images,
    },
  };
}

async function fetchPublishedMarkets(): Promise<GridMarket[]> {
  const [marketResponse, dateResponse, photosResponse] = await Promise.all([
    supabasePublicFetch(
      "markets?status=eq.published&select=id,name,slug,market_type,city,state,hero_image_url,market_vendor_links(count)&order=name.asc",
    ),
    supabasePublicFetch(
      `market_dates?is_canceled=eq.false&date=gte.${todayInLosAngeles()}&select=market_id,date&order=date.asc`,
    ),
    supabasePublicFetch(
      "market_photos?select=market_id,photo_url,sort_order&order=sort_order.asc",
    ),
  ]);

  if (!marketResponse.ok || !dateResponse.ok || !photosResponse.ok) {
    throw new Error("Unable to load published markets");
  }

  const markets = (await marketResponse.json()) as Market[];
  const dates = (await dateResponse.json()) as MarketDate[];
  const photos = (await photosResponse.json()) as MarketPhoto[];
  const firstPhotoByMarket = new Map<string, string>();

  for (const photo of photos) {
    if (!firstPhotoByMarket.has(photo.market_id)) {
      firstPhotoByMarket.set(photo.market_id, photo.photo_url);
    }
  }

  const nextDates = new Map<string, string>();
  const consecutiveEndDates = new Map<string, string>();

  for (const date of dates) {
    if (!nextDates.has(date.market_id)) {
      nextDates.set(date.market_id, date.date);
    }

    const startDate = nextDates.get(date.market_id);
    const previousDate = consecutiveEndDates.get(date.market_id) ?? startDate;
    if (startDate && previousDate) {
      const previous = new Date(`${previousDate}T00:00:00Z`);
      const current = new Date(`${date.date}T00:00:00Z`);
      if (current.getTime() - previous.getTime() === 24 * 60 * 60 * 1000) {
        consecutiveEndDates.set(date.market_id, date.date);
      }
    }
  }

  return markets.map(({ market_vendor_links, ...market }) => ({
    ...market,
    hero_image_url: firstPhotoByMarket.get(market.id) ?? market.hero_image_url,
    next_date: nextDates.get(market.id) ?? null,
    next_date_end: consecutiveEndDates.get(market.id) ?? null,
    vendor_count: market_vendor_links[0]?.count ?? 0,
  }));
}

// The upcoming market whose date range ends soonest (today or later, Pacific time); ties go to the earlier start.
function findNextUp(markets: GridMarket[]) {
  const today = todayInLosAngeles();
  return markets
    .filter((market): market is GridMarket & { next_date: string } => Boolean(market.next_date))
    .map((market) => ({ market, start: market.next_date, end: market.next_date_end ?? market.next_date }))
    .filter(({ end }) => end >= today)
    .sort((first, second) => first.end.localeCompare(second.end) || first.start.localeCompare(second.start))[0]?.market ?? null;
}

export default async function Home() {
  const markets = await fetchPublishedMarkets();
  const nextUp = findNextUp(markets);

  return (
    <main>
      <section className="bg-cream px-5 pt-10 pb-12 sm:px-10 sm:pt-14 sm:pb-[72px] lg:px-[72px]">
        <div className="mx-auto grid max-w-[1296px] gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div>
            <h1 className="font-serif text-[50px] leading-[0.98] font-medium tracking-[-1px] text-navy sm:text-[80px] sm:tracking-[-1.5px]">
              Building community <span className="text-forest">one market at a time.</span>
            </h1>
            <p className="mt-6 max-w-[440px] text-xl leading-normal text-ink-muted">Find local markets, and meet the makers who sell there.</p>
            <a href="#markets" className={`mt-8 ${primaryButtonClass}`}>Find a market</a>
          </div>

          <div className="relative">
            <div className="relative min-h-[220px] overflow-hidden rounded-3xl bg-sky sm:min-h-[540px]">
              {nextUp?.hero_image_url ? (
                <Image
                  src={nextUp.hero_image_url}
                  alt={nextUp.name}
                  fill
                  preload
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <StallPlaceholder className="w-[180px] sm:w-[260px]" tileClassName={nextUp ? "sm:pb-48" : ""} />
              )}
            </div>
            {nextUp ? (
              <div className="mt-4 rounded-2xl border-[1.5px] border-line bg-white p-[18px] sm:absolute sm:inset-x-6 sm:bottom-6 sm:mt-0 sm:border-0 sm:px-7 sm:py-6">
                <span className="inline-block rounded-full bg-clay px-3 py-1.5 text-xs leading-none font-bold tracking-[1.6px] text-white uppercase">Next up</span>
                <p className="mt-3 font-serif text-2xl leading-[1.1] font-semibold text-navy sm:text-[28px]">{nextUp.name}</p>
                <p className="mt-2 text-[15px] text-ink-muted">
                  {formatDateRange(nextUp.next_date, nextUp.next_date_end)} · {formatPlace(nextUp.city, nextUp.state, nextUp.vendor_count)}
                </p>
                <a href={`/markets/${nextUp.slug}`} className={`mt-1 inline-flex min-h-11 items-center text-base font-bold text-clay hover:text-clay-dark ${focusRingClass}`}>
                  See the market →
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section id="markets" aria-labelledby="markets-heading" className="bg-paper px-5 py-10 sm:px-10 sm:pt-[72px] sm:pb-[88px] lg:px-[72px]">
        <div className="mx-auto max-w-[1296px]">
          <MarketGrid markets={markets} />
        </div>
      </section>
    </main>
  );
}
