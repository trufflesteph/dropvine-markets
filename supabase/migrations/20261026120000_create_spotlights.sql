-- Spotlights: short written features on a local maker, each with its own public page. Safe to re-run.
-- Photos go in the existing public market_photos bucket under spotlights/{id}/, so no storage changes are needed.

create table if not exists public.spotlights (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (btrim(title) <> ''),
  summary text not null default '' check (char_length(summary) <= 200),
  body text not null default '',
  maker_name text not null check (btrim(maker_name) <> ''),
  maker_category text,
  vendor_id uuid references public.vendors(id) on delete set null,
  hero_image_url text,
  hero_image_alt text,
  photos jsonb not null default '[]'::jsonb,
  video_url text,
  links jsonb not null default '[]'::jsonb,
  permission_confirmed boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spotlights_hero_alt_required check (hero_image_url is null or nullif(btrim(hero_image_alt), '') is not null),
  constraint spotlights_photos_shape check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 4),
  constraint spotlights_links_shape check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 4),
  constraint spotlights_publish_needs_permission check (status <> 'published' or permission_confirmed)
);

create index if not exists spotlights_status_published_at_idx on public.spotlights (status, sort_order desc, published_at desc);
create index if not exists spotlights_vendor_id_idx on public.spotlights (vendor_id);

-- Reuses the markets trigger function, which only sets updated_at = now().
drop trigger if exists spotlights_set_updated_at on public.spotlights;
create trigger spotlights_set_updated_at
before update on public.spotlights
for each row execute function public.set_markets_updated_at();

alter table public.spotlights enable row level security;

revoke all on table public.spotlights from anon, authenticated;
grant select on table public.spotlights to anon;

drop policy if exists "Public can read published spotlights" on public.spotlights;
create policy "Public can read published spotlights"
on public.spotlights for select to anon
using (status = 'published');

-- A published spotlight links to its vendor (for "Find them at" and "Also on Dropvine Direct"), so that vendor
-- becomes publicly readable even when it isn't at a published market yet. Policies are OR'ed with the existing one.
drop policy if exists "Public can read vendors with published spotlights" on public.vendors;
create policy "Public can read vendors with published spotlights"
on public.vendors for select to anon
using (
  exists (
    select 1 from public.spotlights
    where spotlights.vendor_id = vendors.id
      and spotlights.status = 'published'
  )
);
