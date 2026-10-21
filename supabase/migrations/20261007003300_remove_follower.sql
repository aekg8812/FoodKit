-- V2: remove_follower — lets the followee delete an incoming follower edge.
-- Standard DELETE policy only allows follower_id = auth.uid(), so this RPC is needed.

create or replace function public.remove_follower(p_follower_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_follower_id = auth.uid() then
    raise exception 'cannot remove self';
  end if;

  delete from public.follows
  where follower_id = p_follower_id
    and followee_id = auth.uid();
end;
$$;

revoke all on function public.remove_follower(uuid) from public;
grant execute on function public.remove_follower(uuid) to authenticated;
