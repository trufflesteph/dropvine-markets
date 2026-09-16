import type { Metadata } from "next";

import { supabasePublicFetch } from "@/lib/supabase-public";
import MarketGrid from "./market-grid";

type Market = {
  id: string;
  name: string;
  slug: string;
  market_type: string;
  city: string;
  state: string;
  hero_image_url: string | null;
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

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

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

async function fetchPublishedMarkets() {
  const [marketResponse, dateResponse, photosResponse] = await Promise.all([
    supabasePublicFetch(
      "markets?status=eq.published&select=id,name,slug,market_type,city,state,hero_image_url&order=name.asc",
    ),
    supabasePublicFetch(
      `market_dates?is_canceled=eq.false&date=gte.${todayUtc()}&select=market_id,date&order=date.asc`,
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

  return markets.map((market) => ({
    ...market,
    hero_image_url: firstPhotoByMarket.get(market.id) ?? market.hero_image_url,
    next_date: nextDates.get(market.id) ?? null,
    next_date_end: consecutiveEndDates.get(market.id) ?? null,
  }));
}

export default async function Home() {
  const markets = await fetchPublishedMarkets();

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10 sm:px-8 sm:py-14">
      <header className="mb-12 max-w-2xl">
        <p className="text-sm uppercase tracking-[0.2em] text-black/50">Dropvine Markets</p>
        <h1 className="mt-5 font-serif text-4xl leading-tight sm:text-5xl">Building community one market at a time</h1>
      </header>
      <MarketGrid markets={markets} />
      <p className="mt-16 border-t border-black/10 pt-6 text-sm text-black/55">
        See a market that should be here? Let us know: <a className="underline decoration-black/25 underline-offset-4 hover:decoration-black" href="mailto:hello@dropvine.pro">hello@dropvine.pro</a>
      </p>
    </main>
  );
}
