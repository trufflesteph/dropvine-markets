function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export async function supabaseAdminFetch(
  path: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("apikey", requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));
  headers.set("Authorization", `Bearer ${requiredEnv("SUPABASE_SERVICE_ROLE_KEY")}`);
  headers.set("Content-Type", "application/json");

  return fetch(`${requiredEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
