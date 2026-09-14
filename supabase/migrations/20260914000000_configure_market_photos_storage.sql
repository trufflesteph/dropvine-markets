insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'market_photos',
  'market_photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read market photos" on storage.objects;
create policy "Public can read market photos"
on storage.objects for select to public
using (bucket_id = 'market_photos');