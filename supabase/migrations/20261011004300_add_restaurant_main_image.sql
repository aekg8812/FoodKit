-- Add main_image_path to restaurants for Restaurant Main Image feature.
-- Storage path format: {restaurant_id}/{uuid}.{ext}
-- NULL = no image (placeholder shown in UI).
-- Existing rows remain NULL — no backfill performed.

alter table public.restaurants
  add column main_image_path text;
