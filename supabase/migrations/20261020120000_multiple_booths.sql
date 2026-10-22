-- A vendor can hold several booths at one market: booth_label becomes text[]. Each existing value becomes a
-- one-item array; blank values become null. Safe to re-run: the conversion only happens while the column is text.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'market_vendor_links'
      and column_name = 'booth_label'
      and data_type = 'text'
  ) then
    alter table public.market_vendor_links
      alter column booth_label type text[]
      using case when nullif(btrim(booth_label), '') is null then null else array[btrim(booth_label)] end;
  end if;
end
$$;
