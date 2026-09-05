create extension if not exists pgcrypto;

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  market_type text not null check (market_type in ('farmers', 'artisan', 'holiday', 'night', 'popup', 'vintage', 'other')),
  description text,
  city text not null,
  state text not null,
  address text,
  latitude numeric,
  longitude numeric,
  hero_image_url text,
  map_image_url text,
  organizer_name text,
  organizer_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.market_dates (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references public.markets(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  is_canceled boolean default false,
  note text
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  business_name text not null,
  category text not null,
  photo_url text,
  blurb text,
  dropvine_direct_url text,
  external_url text,
  created_at timestamptz default now()
);

create table public.market_vendor_links (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references public.markets(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  map_x numeric check (map_x is null or (map_x >= 0 and map_x <= 100)),
  map_y numeric check (map_y is null or (map_y >= 0 and map_y <= 100)),
  booth_label text,
  featured boolean default false,
  unique (market_id, vendor_id)
);

create index market_dates_market_id_idx on public.market_dates (market_id);
create index market_dates_date_idx on public.market_dates (date);
create index market_vendor_links_market_id_idx on public.market_vendor_links (market_id);
create index market_vendor_links_vendor_id_idx on public.market_vendor_links (vendor_id);

create or replace function public.set_markets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger markets_set_updated_at
before update on public.markets
for each row execute function public.set_markets_updated_at();

alter table public.markets enable row level security;
alter table public.market_dates enable row level security;
alter table public.vendors enable row level security;
alter table public.market_vendor_links enable row level security;

revoke all on table public.markets from anon, authenticated;
revoke all on table public.market_dates from anon, authenticated;
revoke all on table public.vendors from anon, authenticated;
revoke all on table public.market_vendor_links from anon, authenticated;
grant select on table public.markets to anon;
grant select on table public.market_dates to anon;
grant select on table public.vendors to anon;
grant select on table public.market_vendor_links to anon;

create policy "Public can read published markets"
on public.markets for select to anon
using (status = 'published');

create policy "Public can read dates for published markets"
on public.market_dates for select to anon
using (
  exists (
    select 1 from public.markets
    where markets.id = market_dates.market_id
      and markets.status = 'published'
  )
);

create policy "Public can read vendors at published markets"
on public.vendors for select to anon
using (
  exists (
    select 1
    from public.market_vendor_links
    join public.markets on markets.id = market_vendor_links.market_id
    where market_vendor_links.vendor_id = vendors.id
      and markets.status = 'published'
  )
);

create policy "Public can read links for published markets"
on public.market_vendor_links for select to anon
using (
  exists (
    select 1 from public.markets
    where markets.id = market_vendor_links.market_id
      and markets.status = 'published'
  )
);
