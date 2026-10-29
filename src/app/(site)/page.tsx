import type { Metadata } from "next";
import Image from "next/image";

import SpotlightsSection from "@/components/spotlights-section";
import StallPlaceholder from "@/components/stall-placeholder";
import { focusRingClass, primaryButtonClass } from "@/components/styles";
import { categoryGroupsFor, parseCategoryParam } from "@/lib/category-groups";
import { defaultShareImage, isImageUrl, marketImageUrl } from "@/lib/image-url";
import { absoluteUrl } from "@/lib/site-url";
import { currentRun, formatDateRange, formatPlace, todayInLosAngeles } from "@/lib/market-format";
import { fetchPublishedSpotlightCards } from "@/lib/spotlights-data";
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
};

type VendorLink = {
  market_id: string;
  vendors: { category: string } | null;
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
  const heroImages = markets.flatMap((market) => isImageUrl(market.hero_image_url) ? [{ url: market.hero_image_url }] : []);
  const images = heroImages.length ? heroImages : [defaultShareImage];

  return {
    title: "Markets | Dropvine",
    description: "Find local markets worth wandering through.",
    // Category-filtered URLs (?category=…) all point back to the plain homepage.
    alternates: { canonical: absoluteUrl("/") },
    openGraph: {
      title: "Markets | Dropvine",
      description: "Find local markets worth wandering through.",
      type: "website",
      images,
    },
    twitter: { card: "summary_large_image", images },
  };
}

async function fetchPublishedMarkets(): Promise<GridMarket[]> {
  const [marketResponse, dateResponse, photosResponse, vendorLinksResponse] = await Promise.all([
    supabasePublicFetch(
      "markets?status=eq.published&select=id,name,slug,market_type,city,state,hero_image_url&order=name.asc",
    ),
    // All dates, not just upcoming ones, so a market on day 2 of 2 still shows its full range.
    supabasePublicFetch(
      "market_dates?is_canceled=eq.false&select=market_id,date&order=date.asc",
    ),
    supabasePublicFetch(
      "market_photos?select=market_id,photo_url,sort_order&order=sort_order.asc",
    ),
    // One query for every market's vendors. Like the market page, this uses the public key, so row-level security
    // only returns links for published markets and vendors the public can see; hidden vendors come back as null.
    supabasePublicFetch(
      "market_vendor_links?select=market_id,vendors(category)",
    ),
  ]);

  if (!marketResponse.ok || !dateResponse.ok || !photosResponse.ok || !vendorLinksResponse.ok) {
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

  const datesByMarket = new Map<string, string[]>();
  for (const date of dates) {
    datesByMarket.set(date.market_id, [...(datesByMarket.get(date.market_id) ?? []), date.date]);
  }

  const vendorCategoriesByMarket = new Map<string, string[]>();
  for (const link of (await vendorLinksResponse.json()) as VendorLink[]) {
    if (!link.vendors) continue;
    vendorCategoriesByMarket.set(link.market_id, [...(vendorCategoriesByMarket.get(link.market_id) ?? []), link.vendors.category]);
  }

  const today = todayInLosAngeles();
  return markets.map((market) => {
    const run = currentRun(datesByMarket.get(market.id) ?? [], today);
    const vendorCategories = vendorCategoriesByMarket.get(market.id) ?? [];
    return {
      ...market,
      hero_image_url: marketImageUrl(firstPhotoByMarket.get(market.id), market.hero_image_url),
      range_start: run?.start ?? null,
      next_date: run?.next ?? null,
      next_date_end: run?.end ?? null,
      vendor_count: vendorCategories.length,
      category_groups: categoryGroupsFor(vendorCategories),
    };
  });
}

// The upcoming market whose date range ends soonest (today or later, Pacific time); ties go to the earlier start.
function findNextUp(markets: GridMarket[]) {
  const today = todayInLosAngeles();
  return markets
    .filter((market): market is GridMarket & { range_start: string; next_date_end: string } => Boolean(market.range_start && market.next_date_end))
    .filter((market) => market.next_date_end >= today)
    .sort((first, second) => first.next_date_end.localeCompare(second.next_date_end) || first.range_start.localeCompare(second.range_start))[0] ?? null;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const [markets, spotlights, { category }] = await Promise.all([fetchPublishedMarkets(), fetchPublishedSpotlightCards(), searchParams]);
  const nextUp = findNextUp(markets);

  return (
    <main>
      <section className="bg-cream px-5 pt-10 pb-12 sm:px-10 sm:pt-14 sm:pb-[72px] lg:px-[72px]">
        <div className="mx-auto grid max-w-[1296px] gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div>
            {/* Sized so "One-of-a-kind finds." (about 7.8em wide) stays on one line: fluid on phones, 66px when stacked,
                and tied to the half-width column from lg up. */}
            <h1 className="font-serif text-[length:clamp(32px,calc((100vw_-_40px)/8.2),42px)] leading-none font-medium tracking-[-0.018em] text-navy sm:text-[66px] lg:text-[length:clamp(44px,calc((100vw_-_200px)/16.4),66px)]">
              <span className="whitespace-nowrap">One-of-a-kind</span> finds. <span className="block text-forest">Close to home.</span>
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
                  {formatDateRange(nextUp.range_start, nextUp.next_date_end)} · {formatPlace(nextUp.city, nextUp.state, nextUp.vendor_count)}
                </p>
                <a href={`/markets/${nextUp.slug}`} className={`mt-1 inline-flex min-h-11 items-center text-base font-bold text-clay hover:text-clay-dark ${focusRingClass}`}>
                  See the market →
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Hidden when nothing is published; reusable for the homepage redesign. */}
      <SpotlightsSection spotlights={spotlights} />

      {/* Renders the "Shop by category" band and the Upcoming markets section, which share filter state. */}
      <MarketGrid markets={markets} initialCategories={parseCategoryParam(category)} />
    </main>
  );
}
