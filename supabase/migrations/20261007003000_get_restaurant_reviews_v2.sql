-- get_restaurant_reviews_v2: 店舗詳細用レビュー取得RPC
--
-- scope: 'all' | 'similar' | 'following'
-- sort:  'newest' | 'oldest'
-- limit/offset: ページング
--
-- security:
--   - anon → 0件返却
--   - authenticated のみ EXECUTE 可
--   - user_preference_cards はdefiner内部のみ参照（クライアントへcard keyは返さない）
--   - user_public_profiles から公開列のみ返す（email等は取得しない）

create or replace function public.get_restaurant_reviews_v2(
  p_restaurant_id uuid,
  p_scope         text,
  p_sort          text,
  p_limit         integer,
  p_offset        integer
)
returns table (
  review_id     uuid,
  restaurant_id uuid,
  user_id       uuid,
  username      text,
  name          text,
  avatar_path   text,
  rating        integer,
  comment       text,
  visit_date    date,
  image_path    text,
  created_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return;
  end if;

  if p_scope not in ('all', 'similar', 'following') then
    raise exception 'invalid scope: %', p_scope using errcode = 'invalid_parameter_value';
  end if;

  if p_sort not in ('newest', 'oldest') then
    raise exception 'invalid sort: %', p_sort using errcode = 'invalid_parameter_value';
  end if;

  if p_sort = 'newest' then
    return query
    with
      viewer_cards as (
        select upc.preference_card_id
        from public.user_preference_cards upc
        where upc.user_id = v_uid
      ),
      viewer_card_count as (
        select count(*) as cnt from viewer_cards
      )
    select
      r.id            as review_id,
      r.restaurant_id,
      r.user_id,
      upp.username,
      upp.name,
      upp.avatar_path,
      r.rating,
      r.comment,
      r.visit_date,
      r.image_path,
      r.created_at
    from public.reviews r
    join public.user_public_profiles upp on upp.id = r.user_id
    where r.restaurant_id = p_restaurant_id
      and (
        p_scope = 'all'
        or (
          p_scope = 'following'
          and r.user_id <> v_uid
          and exists (
            select 1
            from public.follows f
            where f.follower_id = v_uid
              and f.followee_id = r.user_id
              and f.status = 'accepted'
          )
        )
        or (
          p_scope = 'similar'
          and (select cnt from viewer_card_count) >= 5
          and (
            select count(*)
            from public.user_preference_cards upc_a
            where upc_a.user_id = r.user_id
          ) >= 5
          and (
            select
              isect >= 3
              and isect::numeric / (vcnt + acnt - isect) >= 0.40
            from (
              select
                (select cnt from viewer_card_count)::bigint as vcnt,
                (
                  select count(*)
                  from public.user_preference_cards upc_b
                  where upc_b.user_id = r.user_id
                )::bigint as acnt,
                count(*)::bigint as isect
              from public.user_preference_cards a
              where a.user_id = r.user_id
                and a.preference_card_id in (
                  select preference_card_id from viewer_cards
                )
            ) sim
          )
        )
      )
    order by r.visit_date desc nulls last, r.created_at desc, r.id desc
    limit  p_limit
    offset p_offset;

  else
    -- oldest
    return query
    with
      viewer_cards as (
        select upc.preference_card_id
        from public.user_preference_cards upc
        where upc.user_id = v_uid
      ),
      viewer_card_count as (
        select count(*) as cnt from viewer_cards
      )
    select
      r.id            as review_id,
      r.restaurant_id,
      r.user_id,
      upp.username,
      upp.name,
      upp.avatar_path,
      r.rating,
      r.comment,
      r.visit_date,
      r.image_path,
      r.created_at
    from public.reviews r
    join public.user_public_profiles upp on upp.id = r.user_id
    where r.restaurant_id = p_restaurant_id
      and (
        p_scope = 'all'
        or (
          p_scope = 'following'
          and r.user_id <> v_uid
          and exists (
            select 1
            from public.follows f
            where f.follower_id = v_uid
              and f.followee_id = r.user_id
              and f.status = 'accepted'
          )
        )
        or (
          p_scope = 'similar'
          and (select cnt from viewer_card_count) >= 5
          and (
            select count(*)
            from public.user_preference_cards upc_a
            where upc_a.user_id = r.user_id
          ) >= 5
          and (
            select
              isect >= 3
              and isect::numeric / (vcnt + acnt - isect) >= 0.40
            from (
              select
                (select cnt from viewer_card_count)::bigint as vcnt,
                (
                  select count(*)
                  from public.user_preference_cards upc_b
                  where upc_b.user_id = r.user_id
                )::bigint as acnt,
                count(*)::bigint as isect
              from public.user_preference_cards a
              where a.user_id = r.user_id
                and a.preference_card_id in (
                  select preference_card_id from viewer_cards
                )
            ) sim
          )
        )
      )
    order by r.visit_date asc nulls last, r.created_at asc, r.id asc
    limit  p_limit
    offset p_offset;
  end if;
end;
$$;

revoke all  on function public.get_restaurant_reviews_v2(uuid, text, text, integer, integer) from public;
grant execute on function public.get_restaurant_reviews_v2(uuid, text, text, integer, integer) to authenticated;
