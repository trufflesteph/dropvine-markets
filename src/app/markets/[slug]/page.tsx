import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { supabasePublicFetch } from "@/lib/supabase-public";
import MarketDetail, { type MarketVendor } from "./market-detail";
import MarketPhotoCarousel from "./market-photo-carousel";

type Market = {
  id: string;
  name: string;
  slug: string;
  market_type: string;
  description: string | null;
  city: string;
  state: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  hero_image_url: string | null;
  map_image_url: string | null;
  organizer_name: string | null;
  organizer_url: string | null;
};

type MarketDate = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
};
type MarketPhoto = { id: string; photo_url: string; sort_order: number };

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatTime(time: string | null) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const value = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(value);
}

async function getMarket(slug: string) {
  const marketResponse = await supabasePublicFetch(
    `markets?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=id,name,slug,market_type,description,city,state,address,latitude,longitude,hero_image_url,map_image_url,organizer_name,organizer_url`,
  );

  if (!marketResponse.ok) throw new Error("Unable to load market");
  const markets = (await marketResponse.json()) as Market[];
  return markets[0] ?? null;
}

async function getMarketContent(marketId: string) {
  const [datesResponse, linksResponse, photosResponse] = await Promise.all([
    supabasePublicFetch(`market_dates?market_id=eq.${marketId}&is_canceled=eq.false&date=gte.${todayUtc()}&select=id,date,start_time,end_time,note&order=date.asc,start_time.asc`),
    supabasePublicFetch(`market_vendor_links?market_id=eq.${marketId}&select=id,map_x,map_y,booth_label,vendors(id,slug,business_name,category,photo_url,dropvine_direct_url)&order=booth_label.asc`),
    supabasePublicFetch(`market_photos?market_id=eq.${marketId}&select=id,photo_url,sort_order&order=sort_order.asc`),
  ]);

  if (!datesResponse.ok || !linksResponse.ok || !photosResponse.ok) throw new Error("Unable to load market details");

  return {
    dates: (await datesResponse.json()) as MarketDate[],
    vendors: (await linksResponse.json()) as MarketVendor[],
    photos: (await photosResponse.json()) as MarketPhoto[],
  };
}

export async function generateMetadata({ params }: PageProps<"/markets/[slug]">): Promise<Metadata> {
  const market = await getMarket((await params).slug);
  if (!market) return {};

  const description = market.description ?? `Explore ${market.name} in ${market.city}, ${market.state}.`;
  return {
    title: `${market.name} | Dropvine Markets`,
    description,
    openGraph: {
      title: `${market.name} | Dropvine Markets`,
      description,
      type: "website",
      images: market.hero_image_url ? [{ url: market.hero_image_url, alt: market.name }] : undefined,
    },
  };
}

export default async function MarketPage({ params }: PageProps<"/markets/[slug]">) {
  const market = await getMarket((await params).slug);
  if (!market) notFound();

  const { dates, vendors, photos } = await getMarketContent(market.id);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8 sm:py-14">
      <article>
        <header className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-black/45">{market.market_type}</p>
            <h1 className="mt-4 max-w-4xl font-serif text-5xl leading-[0.98] sm:text-7xl">{market.name}</h1>
          </div>
          <div className="border-l border-black/10 pl-5 text-sm text-black/60">
            <p>{market.city}, {market.state}</p>
            {market.address ? <p className="mt-1">{market.address}</p> : null}
            {market.organizer_name ? <p className="mt-5">Organized by {market.organizer_url ? <a className="text-black underline decoration-black/25 underline-offset-4 hover:decoration-black" href={market.organizer_url}>{market.organizer_name}</a> : market.organizer_name}</p> : null}
          </div>
        </header>

        <MarketPhotoCarousel marketName={market.name} photos={photos.length ? photos : market.hero_image_url ? [{ id: "legacy-hero", photo_url: market.hero_image_url }] : []} />

        {market.description ? <section className="mt-16 max-w-3xl"><p className="text-xl leading-relaxed sm:text-2xl">{market.description}</p></section> : null}

        <section aria-labelledby="upcoming-dates-heading" className="mt-20 border-t border-black/10 pt-10">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Plan your visit</p>
          <h2 id="upcoming-dates-heading" className="mt-2 font-serif text-3xl">Upcoming dates</h2>
          {dates.length ? (
            <div className="mt-6 divide-y divide-black/10 border-y border-black/10">
              {dates.map((date) => {
                const start = formatTime(date.start_time);
                const end = formatTime(date.end_time);
                return <div key={date.id} className="grid gap-1 py-4 sm:grid-cols-[minmax(220px,1fr)_minmax(0,1fr)] sm:gap-6"><p className="font-serif text-xl">{formatDate(date.date)}</p><p className="text-sm text-black/60">{start ? `${start}${end ? ` - ${end}` : ""}` : "Time to be announced"}{date.note ? ` · ${date.note}` : ""}</p></div>;
              })}
            </div>
          ) : <p className="mt-6 border border-black/10 px-5 py-8 text-sm text-black/55">No upcoming dates scheduled</p>}
        </section>

        <MarketDetail mapImageUrl={market.map_image_url} latitude={market.latitude} longitude={market.longitude} vendors={vendors} />
      </article>
    </main>
  );
}