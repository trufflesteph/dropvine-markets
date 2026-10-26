import assert from "node:assert/strict";
import { test } from "node:test";

import { absoluteUrl, normalizeSiteUrl } from "../src/lib/site-url.ts";
import { buildSitemap, type SitemapMarket, type SitemapSpotlight, type SitemapVendor, staticSitemap } from "../src/lib/sitemap.ts";

const base = "https://www.example.test";
const urls = (entries: { url: string }[]) => entries.map((entry) => entry.url);

const markets: SitemapMarket[] = [
  { slug: "west-linn-holiday-bazaar", status: "published", updated_at: "2026-10-01T12:00:00+00:00" },
  { slug: "draft-market", status: "draft", updated_at: "2026-10-02T12:00:00+00:00" },
  { slug: "hidden-market", status: "hidden", updated_at: null },
  { slug: "no-date-market", status: "published", updated_at: null },
];

const published = { markets: { status: "published" } };
const vendors: SitemapVendor[] = [
  { slug: "happy-knits", dropvine_direct_url: null, market_vendor_links: [published] },
  { slug: "draft-only-vendor", dropvine_direct_url: null, market_vendor_links: [{ markets: { status: "draft" } }] },
  // How RLS returns a linked market the public can't see.
  { slug: "rls-hidden-vendor", dropvine_direct_url: null, market_vendor_links: [{ markets: null }] },
  { slug: "unlinked-vendor", dropvine_direct_url: null, market_vendor_links: [] },
  { slug: "no-links-field", dropvine_direct_url: null, market_vendor_links: null },
  { slug: "two-markets", dropvine_direct_url: null, market_vendor_links: [{ markets: { status: "draft" } }, published] },
  { slug: "on-dropvine-direct", dropvine_direct_url: "https://dropvine.pro/shop/x", market_vendor_links: [published] },
];

test("static pages are always present, with absolute URLs on the shared site URL", () => {
  assert.deepEqual(urls(staticSitemap(base)), [`${base}/`, `${base}/about`]);
  assert.deepEqual(urls(buildSitemap(base, markets, vendors)).slice(0, 2), [`${base}/`, `${base}/about`]);
});

test("only published markets are included, with lastModified from updated_at when present", () => {
  const entries = buildSitemap(base, markets, []).filter((entry) => entry.url.includes("/markets/"));
  assert.deepEqual(urls(entries), [`${base}/markets/no-date-market`, `${base}/markets/west-linn-holiday-bazaar`]);
  assert.equal(entries.find((entry) => entry.url.endsWith("/west-linn-holiday-bazaar"))?.lastModified?.valueOf(), Date.parse("2026-10-01T12:00:00Z"));
  assert.ok(!("lastModified" in entries.find((entry) => entry.url.endsWith("/no-date-market"))!), "no invented dates");
});

test("only vendors linked to a published market are included, and never Dropvine Direct redirects", () => {
  const entries = buildSitemap(base, [], vendors).filter((entry) => entry.url.includes("/vendors/"));
  assert.deepEqual(urls(entries), [`${base}/vendors/happy-knits`, `${base}/vendors/two-markets`]);
  for (const entry of entries) assert.ok(!("lastModified" in entry), "vendors have no updated-at, so no lastModified");
});

test("published spotlights and /spotlights are included; drafts never, and no index without spotlights", () => {
  const spotlights: SitemapSpotlight[] = [
    { slug: "meet-clay-co", status: "published", updated_at: "2026-10-20T12:00:00+00:00" },
    { slug: "draft-feature", status: "draft", updated_at: null },
    { slug: "meet-clay-co", status: "published", updated_at: null },
  ];
  const entries = urls(buildSitemap(base, [], [], spotlights)).filter((url) => url.includes("/spotlights"));
  assert.deepEqual(entries, [`${base}/spotlights`, `${base}/spotlights/meet-clay-co`]);
  assert.ok(!urls(buildSitemap(base, [], [], [spotlights[1]])).some((url) => url.includes("/spotlights")));
  assert.ok(!urls(buildSitemap(base, markets, vendors)).some((url) => url.includes("/spotlights")));
});

test("every URL is absolute, on the configured site, with slugs encoded and no duplicates", () => {
  const entries = buildSitemap(base, [...markets, markets[0], { slug: "café & co", status: "published", updated_at: "not a date" }], [...vendors, vendors[0]]);
  for (const { url } of entries) assert.ok(url.startsWith(`${base}/`), url);
  assert.equal(new Set(urls(entries)).size, entries.length);
  assert.ok(urls(entries).includes(`${base}/markets/caf%C3%A9%20%26%20co`));
  assert.ok(!("lastModified" in entries.find((entry) => entry.url.includes("caf%C3%A9"))!), "an unparseable date is omitted, not guessed");
});

test("the site URL helper normalizes the configured value", () => {
  assert.equal(normalizeSiteUrl("https://www.dropvinemarkets.com/"), "https://www.dropvinemarkets.com");
  assert.equal(normalizeSiteUrl("  https://dropvinemarkets.com//  "), "https://dropvinemarkets.com");
  assert.equal(normalizeSiteUrl(undefined), "https://dropvinemarkets.com");
  assert.equal(absoluteUrl("about", base), `${base}/about`);
  assert.equal(absoluteUrl("/", base), `${base}/`);
});
