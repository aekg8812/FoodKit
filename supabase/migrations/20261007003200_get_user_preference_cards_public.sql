-- V2: public preference card display for other users (bypasses self-only user_preference_cards RLS)
-- Returns only display-safe fields — never raw keys or user_id.

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
  where upc.user_id = p_user_id
  order by pc.sort_order;
$$;

revoke all on function public.get_user_preference_cards_public(uuid) from public;
grant execute on function public.get_user_preference_cards_public(uuid) to authenticated;
