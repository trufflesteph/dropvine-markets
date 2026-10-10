-- Market alerts: shoppers subscribe with email + ZIP + radius (double opt-in) and are emailed when a new
-- market near them is published. Every table here is private: RLS is on, there are no policies, and anon /
-- authenticated get no grants, so only server code using the service-role key can read or write them.

-- ZIP (ZCTA) centroids from the US Census Bureau Gazetteer. Loaded by scripts/seed-zip-codes.mjs.
create table if not exists public.zip_codes (
  zip text primary key check (zip ~ '^[0-9]{5}$'),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180)
);

create table if not exists public.alert_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and length(email) <= 254),
  zip text not null references public.zip_codes(zip),
  radius_miles integer not null default 25 check (radius_miles in (10, 25, 50, 100)),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  confirm_token text not null unique check (length(confirm_token) >= 43),
  unsubscribe_token text not null unique check (length(unsubscribe_token) >= 43),
  created_at timestamptz not null default now(),
  confirmation_sent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  unique (email, zip)
);

create index if not exists alert_subscribers_status_idx on public.alert_subscribers (status);

-- One row per subscriber per market, written before the email goes out, so no one is emailed twice about
-- the same market even if "Send alerts" is clicked twice or runs concurrently.
create table if not exists public.alert_sends (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.alert_subscribers(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  sent_at timestamptz not null default now(),
  unique (subscriber_id, market_id)
);

-- Failed attempts are logged here and not counted as sent, so a later "Send alerts" retries them.
create table if not exists public.alert_send_failures (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.alert_subscribers(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  error text not null,
  failed_at timestamptz not null default now()
);

-- Sign-up attempts per hashed client IP, for a basic rate limit that works across serverless instances.
create table if not exists public.alert_signup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists alert_signup_attempts_ip_hash_created_at_idx
  on public.alert_signup_attempts (ip_hash, created_at);

alter table public.zip_codes enable row level security;
alter table public.alert_subscribers enable row level security;
alter table public.alert_sends enable row level security;
alter table public.alert_send_failures enable row level security;
alter table public.alert_signup_attempts enable row level security;

revoke all on table public.zip_codes from anon, authenticated;
revoke all on table public.alert_subscribers from anon, authenticated;
revoke all on table public.alert_sends from anon, authenticated;
revoke all on table public.alert_send_failures from anon, authenticated;
revoke all on table public.alert_signup_attempts from anon, authenticated;
revoke all on sequence public.alert_signup_attempts_id_seq from anon, authenticated;

-- The Data API only reaches tables a role has been granted, separately from RLS. Server code uses the
-- service-role key, so grant service_role alone; anon and authenticated get nothing.
grant select, insert, update, delete on public.zip_codes to service_role;
grant select, insert, update, delete on public.alert_subscribers to service_role;
grant select, insert, update, delete on public.alert_sends to service_role;
grant select, insert, update, delete on public.alert_send_failures to service_role;
grant select, insert, update, delete on public.alert_signup_attempts to service_role;
grant usage, select on sequence public.alert_signup_attempts_id_seq to service_role;

-- Markets: optional ZIP, used to locate a market for alert matching when it has no coordinates.
alter table public.markets
  add column if not exists zip text check (zip is null or zip ~ '^[0-9]{5}$');
