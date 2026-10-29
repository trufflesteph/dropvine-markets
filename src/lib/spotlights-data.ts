import { unstable_rethrow } from "next/navigation";

import { todayInLosAngeles } from "./market-format.ts";
import { type AppearanceLink, marketSpotlights, type SpotlightLink, type SpotlightPhoto, type SpotlightStatus, upcomingAppearances } from "./spotlights.ts";
import { supabaseAdminFetch } from "./supabase-admin.ts";
import { supabasePublicFetch } from "./supabase-public.ts";

export type Spotlight = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  maker_name: string;
  maker_category: string | null;
  vendor_id: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  photos: SpotlightPhoto[];
  video_url: string | null;
  links: SpotlightLink[];
  permission_confirmed: boolean;
  status: SpotlightStatus;
  published_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SpotlightCard = Pick<Spotlight, "id" | "slug" | "title" | "summary" | "maker_name" | "maker_category" | "hero_image_url" | "hero_image_alt">;

export type SpotlightVendor = { id: string; slug: string; business_name: string; category: string; dropvine_direct_url: string | null };

const cardFields = "id,slug,title,summary,maker_name,maker_category,hero_image_url,hero_image_alt";
const publicOrder = "order=sort_order.desc,published_at.desc.nullslast";

// Every public read goes through the anon key, so RLS only ever returns published rows. A failure (for example
// before the spotlights migration has run) is logged and treated as "no spotlights" so pages keep working.
async function publicJson<T>(path: string, fallback: T, options: { revalidate?: number } = {}): Promise<T> {
  try {
    const response = await supabasePublicFetch(path, options);
    if (!response.ok) throw new Error(`Supabase responded ${response.status}: ${await response.text()}`);
    return (await response.json()) as T;
  } catch (error) {
    // Let Next's own control-flow errors through (e.g. the one that switches a route to dynamic rendering);
    // swallowing them could freeze a page at build time with no spotlights.
    unstable_rethrow(error);
    console.error(`[spotlights] Could not load ${path.split("?")[0]}:`, error);
    return fallback;
  }
}

export function fetchPublishedSpotlightCards() {
  return publicJson<SpotlightCard[]>(`spotlights?status=eq.published&select=${cardFields}&${publicOrder}`, []);
}

// Drives the header link; cached briefly because the header renders on every public page.
export async function hasPublishedSpotlights() {
  return (await publicJson<{ id: string }[]>("spotlights?status=eq.published&select=id&limit=1", [], { revalidate: 300 })).length > 0;
}

// Published spotlight by slug; drafts only when allowDraft (an admin preview), read with the service key.
export async function getSpotlight(slug: string, allowDraft = false): Promise<Spotlight | null> {
  const query = `spotlights?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`;
  const published = await publicJson<Spotlight[]>(`${query}&status=eq.published`, []);
  if (published[0] || !allowDraft) return published[0] ?? null;
  const response = await supabaseAdminFetch(query);
  if (!response.ok) throw new Error(await response.text());
  return ((await response.json()) as Spotlight[])[0] ?? null;
}

export async function getSpotlightVendor(vendorId: string) {
  const rows = await publicJson<SpotlightVendor[]>(`vendors?id=eq.${encodeURIComponent(vendorId)}&select=id,slug,business_name,category,dropvine_direct_url&limit=1`, []);
  return rows[0] ?? null;
}

export async function getVendorAppearances(vendorId: string) {
  const links = await publicJson<AppearanceLink[]>(
    `market_vendor_links?vendor_id=eq.${encodeURIComponent(vendorId)}&select=booth_label,markets(slug,name,market_dates(date,is_canceled))`,
    [],
  );
  return upcomingAppearances(links, todayInLosAngeles());
}

export type VendorSpotlightCard = SpotlightCard & { vendor_id: string | null };

// Published spotlights for a market's vendors, in public order. The query already limits to these vendors;
// marketSpotlights re-checks it so a spotlight for a vendor at another market can never slip through.
export async function fetchMarketSpotlights(linkedVendorIds: string[]) {
  if (!linkedVendorIds.length) return [];
  const rows = await publicJson<VendorSpotlightCard[]>(
    `spotlights?status=eq.published&vendor_id=in.(${linkedVendorIds.map(encodeURIComponent).join(",")})&select=${cardFields},vendor_id&${publicOrder}`,
    [],
  );
  return marketSpotlights(rows, linkedVendorIds);
}
