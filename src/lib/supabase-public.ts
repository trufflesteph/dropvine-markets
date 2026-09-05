function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export async function supabasePublicFetch(path: string) {
  const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const headers = new Headers({
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  });

  return fetch(`${requiredEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/${path}`, {
    headers,
    cache: "no-store",
  });
}
