create table if not exists public.market_photos (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  photo_url text not null,
  sort_order integer not null default 0
);

create index if not exists market_photos_market_id_sort_order_idx
  on public.market_photos (market_id, sort_order);

alter table public.market_photos enable row level security;

revoke all on table public.market_photos from anon, authenticated;
grant select on table public.market_photos to anon;

drop policy if exists "Public can read photos for published markets" on public.market_photos;
create policy "Public can read photos for published markets"
on public.market_photos for select to anon
using (
  exists (
    select 1 from public.markets
    where markets.id = market_photos.market_id
      and markets.status = 'published'
  )
);

insert into public.market_photos (market_id, photo_url, sort_order)
select id, hero_image_url, 0
from public.markets
where hero_image_url is not null
  and not exists (
    select 1 from public.market_photos
    where market_photos.market_id = markets.id
      and market_photos.photo_url = markets.hero_image_url
  );