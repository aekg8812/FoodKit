-- Add meal_period_tags column to restaurants.
-- NULL = unknown period. Non-null must be non-empty and contain only 'lunch' or 'dinner'.

alter table public.restaurants
  add column if not exists meal_period_tags text[];

alter table public.restaurants
  add constraint restaurants_meal_period_tags_valid
    check (
      meal_period_tags is null
      or (
        cardinality(meal_period_tags) >= 1
        and meal_period_tags <@ array['lunch', 'dinner']::text[]
      )
    );

create index if not exists idx_restaurants_meal_period_tags
  on public.restaurants using gin (meal_period_tags);
