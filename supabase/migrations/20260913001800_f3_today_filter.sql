alter table public.restaurants add column budget_range text;
alter table public.restaurants add column party_size_note text;

alter table public.restaurants add constraint restaurants_budget_range_check
  check (budget_range is null or budget_range in ('low', 'mid', 'high'));

create or replace function public.get_recommendations_filtered(
  p_area text default null,
  p_genre text default null,
  p_budget_range text default null,
  p_limit int default 10
)
returns table(
  restaurant_id uuid,
  name text,
  area text,
  genre text,
  same_type_review_count bigint,
  rating_4_count bigint,
  rating_3_count bigint,
  rating_2_count bigint,
  rating_1_count bigint
)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with my_type as (
    select main_value_type
    from public.user_value_profiles
    where user_id = auth.uid()
  )
  select
    r.id, r.name, r.area, r.genre,
    count(*) as same_type_review_count,
    count(*) filter (where rv.rating = 4) as rating_4_count,
    count(*) filter (where rv.rating = 3) as rating_3_count,
    count(*) filter (where rv.rating = 2) as rating_2_count,
    count(*) filter (where rv.rating = 1) as rating_1_count
  from public.restaurants r
  join public.reviews rv on rv.restaurant_id = r.id
  join public.user_value_profiles p on p.user_id = rv.user_id
  where p.main_value_type = (select main_value_type from my_type)
    and r.id not in (
      select restaurant_id from public.reviews where user_id = auth.uid()
    )
    and (p_area is null or r.area ilike '%' || p_area || '%')
    and (p_genre is null or r.genre ilike '%' || p_genre || '%')
    and (p_budget_range is null or r.budget_range = p_budget_range or r.budget_range is null)
  group by r.id, r.name, r.area, r.genre
  having count(*) >= 3
  order by
    (count(*) filter (where rv.rating = 4) * 2 + count(*) filter (where rv.rating = 3) * 1)::float
      / count(*) desc,
    count(*) desc
  limit greatest(1, least(p_limit, 50));
$$;
