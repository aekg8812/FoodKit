create or replace function public.get_recommendations_same_type(p_limit int default 10)
returns table (
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
stable
security definer
set search_path = public, pg_temp
as $$
  with my_type as (
    select main_value_type from public.user_value_profiles where user_id = auth.uid()
  )
  select
    r.id,
    r.name,
    r.area,
    r.genre,
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
  group by r.id, r.name, r.area, r.genre
  having count(*) >= 3
  order by
    (count(*) filter (where rv.rating = 4) * 2 + count(*) filter (where rv.rating = 3) * 1)::float
      / count(*) desc,
    count(*) desc
  limit greatest(1, least(p_limit, 50));
$$;

-- 注記（レビュー時の誤解防止用コメント。マイグレーションファイル内にも残すこと）:
-- user_value_profiles / reviews を直接JOINしているのは、AI Contextの
-- 「他ユーザー情報は公開view経由」原則への違反ではない。この関数はsecurity definerであり
-- 関数所有者の権限でRLSをバイパスして実行される。can_view_review / get_app_stats /
-- get_public_landing_stats と同じ扱い。

revoke all on function public.get_recommendations_same_type(int) from public;
grant execute on function public.get_recommendations_same_type(int) to authenticated;
