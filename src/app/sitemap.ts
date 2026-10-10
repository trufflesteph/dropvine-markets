import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";
import { buildSitemap, type SitemapMarket, type SitemapVendor, staticSitemap } from "@/lib/sitemap";
import { supabasePublicFetch } from "@/lib/supabase-public";

// Rebuilt at most about once an hour, not on every request.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    // One query per table, read with the public (anon) key like the public pages, so RLS hides anything private.
    const [marketsResponse, vendorsResponse] = await Promise.all([
      supabasePublicFetch("markets?status=eq.published&select=slug,status,updated_at&order=slug.asc", { revalidate }),
      supabasePublicFetch("vendors?select=slug,dropvine_direct_url,market_vendor_links(markets(status))&order=slug.asc", { revalidate }),
    ]);
    if (!marketsResponse.ok || !vendorsResponse.ok) {
      throw new Error(`Supabase responded ${marketsResponse.status} (markets) / ${vendorsResponse.status} (vendors)`);
    }
    return buildSitemap(siteUrl, (await marketsResponse.json()) as SitemapMarket[], (await vendorsResponse.json()) as SitemapVendor[]);
  } catch (error) {
    // Never fail the sitemap: fall back to the static pages and log why.
    console.error("[sitemap] Could not load markets and vendors; serving static pages only.", error);
    return staticSitemap(siteUrl);
  }
}
