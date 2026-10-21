-- V2: follow counts RPC (security definer bypasses self-only follows RLS)

create or replace function public.get_user_follow_counts(p_user_id uuid)
returns table(following_count bigint, follower_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.follows where follower_id = p_user_id and status = 'accepted') as following_count,
    (select count(*) from public.follows where followee_id = p_user_id and status = 'accepted') as follower_count;
$$;

revoke all on function public.get_user_follow_counts(uuid) from public;
grant execute on function public.get_user_follow_counts(uuid) to authenticated;
