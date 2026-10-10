import type { MetadataRoute } from "next";

import { absoluteUrl } from "./site-url.ts";

export type SitemapMarket = { slug: string; status: string; updated_at: string | null };
export type SitemapVendor = {
  slug: string;
  dropvine_direct_url: string | null;
  market_vendor_links: { markets: { status: string } | null }[] | null;
};

export const staticPaths = ["/", "/about"] as const;

function validDate(value: string | null) {
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value) : undefined;
}

// Same visibility as the public pages:
// - a market page exists only for status = published (the market page filters on it; RLS enforces it for anon);
// - a vendor page exists only for a vendor linked to a published market (the vendors RLS policy) and without
//   a Dropvine Direct URL, since those vendor pages redirect off-site.
// The data is read with the anon key, so RLS already applies; the checks here make the rules explicit and testable.
export function buildSitemap(base: string, markets: SitemapMarket[], vendors: SitemapVendor[]): MetadataRoute.Sitemap {
  const staticEntries = staticPaths.map((path) => ({ url: absoluteUrl(path, base) }));

  const marketEntries = [...new Map(markets
    .filter((market) => market.status === "published" && market.slug)
    .map((market) => [market.slug, market])).values()]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((market) => {
      const lastModified = validDate(market.updated_at);
      return { url: absoluteUrl(`/markets/${encodeURIComponent(market.slug)}`, base), ...(lastModified ? { lastModified } : {}) };
    });

  // Vendors have no updated-at column, so they get no lastModified.
  const vendorEntries = [...new Set(vendors
    .filter((vendor) => vendor.slug && !vendor.dropvine_direct_url)
    .filter((vendor) => (vendor.market_vendor_links ?? []).some((link) => link.markets?.status === "published"))
    .map((vendor) => vendor.slug))]
    .sort((a, b) => a.localeCompare(b))
    .map((slug) => ({ url: absoluteUrl(`/vendors/${encodeURIComponent(slug)}`, base) }));

  return [...staticEntries, ...marketEntries, ...vendorEntries];
}

export function staticSitemap(base: string): MetadataRoute.Sitemap {
  return buildSitemap(base, [], []);
}
