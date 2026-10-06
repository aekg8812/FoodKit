-- Phase 1 columns for V2 "Today's Restaurant" search
-- Adds 5 nullable columns to restaurants table.
-- NULL means "unknown / not entered" in all cases.
-- Array columns reject empty arrays and disallow values outside the defined tag sets.

alter table public.restaurants
  add column party_size_tags    text[],
  add column budget_per_person_max_yen integer,
  add column atmosphere_tags    text[],
  add column walk_in_available  boolean,
  add column parking_available  boolean;

-- party_size_tags: NULL or non-empty subset of the four allowed tags
alter table public.restaurants
  add constraint restaurants_party_size_tags_check check (
    party_size_tags is null
    or (
      cardinality(party_size_tags) >= 1
      and party_size_tags <@ array['solo', 'pair', 'small_group', 'large_group']
    )
  );

-- atmosphere_tags: NULL or non-empty subset of the three allowed tags
alter table public.restaurants
  add constraint restaurants_atmosphere_tags_check check (
    atmosphere_tags is null
    or (
      cardinality(atmosphere_tags) >= 1
      and atmosphere_tags <@ array['lively', 'relaxed', 'casual']
    )
  );

-- budget_per_person_max_yen: NULL or a positive integer
alter table public.restaurants
  add constraint restaurants_budget_per_person_max_yen_check check (
    budget_per_person_max_yen is null
    or budget_per_person_max_yen > 0
  );

-- GIN indexes for @> (contains) operator used in today-search filtering
create index restaurants_party_size_tags_gin_idx
  on public.restaurants using gin (party_size_tags);

create index restaurants_atmosphere_tags_gin_idx
  on public.restaurants using gin (atmosphere_tags);
