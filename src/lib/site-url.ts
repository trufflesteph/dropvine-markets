// The one place the site's canonical origin is defined. Everything that builds an absolute URL
// (metadataBase, canonical links, sitemap, robots, alert emails) uses this.
export function normalizeSiteUrl(value: string | undefined) {
  return (value?.trim() || "https://dropvinemarkets.com").replace(/\/+$/, "");
}

export const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

/** Absolute URL for a site path, e.g. absoluteUrl("/about"). */
export function absoluteUrl(path: string, base = siteUrl) {
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
