function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

// Pages fetch fresh data (no-store) by default; pass revalidate (seconds) for cached routes such as the sitemap.
export async function supabasePublicFetch(path: string, options: { revalidate?: number } = {}) {
  const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const headers = new Headers({
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  });

  return fetch(`${requiredEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/${path}`, {
    headers,
    ...(options.revalidate === undefined ? { cache: "no-store" as const } : { next: { revalidate: options.revalidate } }),
  });
}
