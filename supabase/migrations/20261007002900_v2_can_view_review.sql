-- V2: any authenticated user can view any review.
-- Anonymousには引き続き閲覧不可。
-- can_view_review_image と restaurants_select_via_visible_review は
-- この関数に委譲しているので自動追従する。

create or replace function public.can_view_review(p_review_user_id uuid, p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null;
$$;

-- GRANTは既存定義を維持: authenticated のみ実行可
revoke all on function public.can_view_review(uuid, uuid) from public;
grant execute on function public.can_view_review(uuid, uuid) to authenticated;
