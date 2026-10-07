-- Harden get_user_follow_counts and get_user_preference_cards_public
-- to add explicit auth.uid() IS NULL guard per FoodKit security-definer RPC contract.
-- Existing 03100/03200 are not modified. This CREATE OR REPLACE replaces them.
-- Signatures unchanged. No overloads added.

create or replace function public.get_user_follow_counts(p_user_id uuid)
returns table(following_count bigint, follower_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.follows where auth.uid() is not null and follower_id = p_user_id and status = 'accepted') as following_count,
    (select count(*) from public.follows where auth.uid() is not null and followee_id = p_user_id and status = 'accepted') as follower_count;
$$;

revoke all on function public.get_user_follow_counts(uuid) from public;
grant execute on function public.get_user_follow_counts(uuid) to authenticated;

create or replace function public.get_user_preference_cards_public(p_user_id uuid)
returns table(label text, description text, image_path text, sort_order integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pc.label, pc.description, pc.image_path, pc.sort_order
  from public.user_preference_cards upc
  join public.preference_cards pc on pc.id = upc.preference_card_id
  where auth.uid() is not null
    and upc.user_id = p_user_id
  order by pc.sort_order;
$$;

revoke all on function public.get_user_preference_cards_public(uuid) from public;
grant execute on function public.get_user_preference_cards_public(uuid) to authenticated;
