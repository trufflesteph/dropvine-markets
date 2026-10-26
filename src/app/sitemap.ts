import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";
import { buildSitemap, type SitemapMarket, type SitemapSpotlight, type SitemapVendor, staticSitemap } from "@/lib/sitemap";
import { supabasePublicFetch } from "@/lib/supabase-public";

// Rebuilt at most about once an hour, not on every request.
export const revalidate = 3600;

// Spotlights are optional: if they can't be read (for example before their migration runs), the rest still lists.
async function fetchSpotlights(): Promise<SitemapSpotlight[]> {
  try {
    const response = await supabasePublicFetch("spotlights?status=eq.published&select=slug,status,updated_at&order=slug.asc", { revalidate });
    if (!response.ok) throw new Error(`Supabase responded ${response.status} (spotlights)`);
    return (await response.json()) as SitemapSpotlight[];
  } catch (error) {
    console.error("[sitemap] Could not load spotlights; leaving them out.", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    // One query per table, read with the public (anon) key like the public pages, so RLS hides anything private.
    const [marketsResponse, vendorsResponse, spotlights] = await Promise.all([
      supabasePublicFetch("markets?status=eq.published&select=slug,status,updated_at&order=slug.asc", { revalidate }),
      supabasePublicFetch("vendors?select=slug,dropvine_direct_url,market_vendor_links(markets(status))&order=slug.asc", { revalidate }),
      fetchSpotlights(),
    ]);
    if (!marketsResponse.ok || !vendorsResponse.ok) {
      throw new Error(`Supabase responded ${marketsResponse.status} (markets) / ${vendorsResponse.status} (vendors)`);
    }
    return buildSitemap(siteUrl, (await marketsResponse.json()) as SitemapMarket[], (await vendorsResponse.json()) as SitemapVendor[], spotlights);
  } catch (error) {
    // Never fail the sitemap: fall back to the static pages and log why.
    console.error("[sitemap] Could not load markets and vendors; serving static pages only.", error);
    return staticSitemap(siteUrl);
  }
}
