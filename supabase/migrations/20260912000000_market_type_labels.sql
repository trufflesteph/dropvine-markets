alter table public.markets drop constraint if exists markets_market_type_check;

alter table public.markets
  add constraint markets_market_type_check
  check (market_type in ('Farmers', 'Artisan-Craft', 'Holiday', 'Night', 'Popup', 'Vintage-Flea', 'Other'))
  not valid;