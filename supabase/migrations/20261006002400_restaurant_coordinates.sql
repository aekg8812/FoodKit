-- Batch C: Add lat/lng columns to restaurants for V2 distance filtering.
-- Existing rows stay NULL (coordinates filled later, not via geocoding service).

alter table public.restaurants
  add column if not exists lat double precision,
  add column if not exists lng double precision;

alter table public.restaurants
  add constraint restaurants_lat_range
    check (lat is null or (lat >= -90  and lat <= 90)),
  add constraint restaurants_lng_range
    check (lng is null or (lng >= -180 and lng <= 180));
