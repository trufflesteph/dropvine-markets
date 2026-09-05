import type { Metadata } from "next";

import { supabasePublicFetch } from "@/lib/supabase-public";
import MarketGrid from "./market-grid";

export const metadata: Metadata = {
  title: "Markets | Dropvine",
  description: "Find local markets worth wandering through.",
};

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

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchPublishedMarkets() {
  const marketResponse = await supabasePublicFetch(
    "markets?status=eq.published&select=id,name,slug,market_type,city,state,hero_image_url&order=name.asc",
  );
  const dateResponse = await supabasePublicFetch(
    `market_dates?is_canceled=eq.false&date=gte.${todayUtc()}&select=market_id,date&order=date.asc`,
  );

  if (!marketResponse.ok || !dateResponse.ok) {
    throw new Error("Unable to load published markets");
  }

  const markets = (await marketResponse.json()) as Market[];
  const dates = (await dateResponse.json()) as MarketDate[];
  const nextDates = new Map<string, string>();

  for (const date of dates) {
    if (!nextDates.has(date.market_id)) {
      nextDates.set(date.market_id, date.date);
    }
  }

  return markets.map((market) => ({
    ...market,
    next_date: nextDates.get(market.id) ?? null,
  }));
}

export default async function Home() {
  const markets = await fetchPublishedMarkets();

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10 sm:px-8 sm:py-14">
      <header className="mb-12 max-w-2xl">
        <p className="text-sm uppercase tracking-[0.2em] text-black/50">Dropvine Markets</p>
        <h1 className="mt-5 font-serif text-4xl leading-tight sm:text-5xl">Find something good nearby.</h1>
      </header>
      <MarketGrid markets={markets} />
    </main>
  );
}
