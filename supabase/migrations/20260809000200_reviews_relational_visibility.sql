-- Task A: reviews スキーマ変更
alter table public.reviews alter column group_id drop not null;
alter table public.reviews alter column visibility set default 'private';

-- 既存データ移行（CHECK制約より前に実行）
update public.reviews
  set visibility = 'private', group_id = null
  where visibility = 'group';

-- CHECK制約（将来の group / public も許容する形で）
alter table public.reviews add constraint reviews_visibility_group_check check (
  (visibility = 'private' and group_id is null) or
  (visibility = 'group'   and group_id is not null) or
  (visibility = 'public'  and group_id is null)
);

-- Task B: 判定関数

-- can_view_review: レビューの閲覧可否。条件を1箇所に集約する。
-- (1) 自分の記録は常に見える
-- (2) 同グループメンバー: 自分と著者が同じグループGに所属し、その店がGにgroup共有されている
--     gm_them (著者の所属) がないと、店を記録しているだけの第三者のレビューまで見えてしまう
-- (3) 相互フォロー友人は A3 でここに or を1本追加する
create or replace function public.can_view_review(p_review_user_id uuid, p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_review_user_id = auth.uid()
    or exists (
      select 1
      from restaurant_accesses ra
      join group_members gm_me
        on gm_me.group_id = ra.group_id and gm_me.user_id = auth.uid()
      join group_members gm_them
        on gm_them.group_id = ra.group_id and gm_them.user_id = p_review_user_id
      where ra.restaurant_id = p_restaurant_id
        and ra.visibility = 'group'
    )
  ;
$$;

revoke all on function public.can_view_review(uuid, uuid) from public;
grant execute on function public.can_view_review(uuid, uuid) to authenticated;

-- can_record_restaurant: レビュー投稿可否（private行所有 or グループ経由アクセス）
create or replace function public.can_record_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from restaurant_accesses ra
    where ra.restaurant_id = p_restaurant_id
      and (
        (ra.visibility = 'private' and ra.user_id = auth.uid())
        or (ra.visibility = 'group' and exists (
              select 1 from group_members gm
              where gm.group_id = ra.group_id and gm.user_id = auth.uid()))
      )
  );
$$;

revoke all on function public.can_record_restaurant(uuid) from public;
grant execute on function public.can_record_restaurant(uuid) to authenticated;

-- Task C: reviews RLS 差し替え
drop policy if exists "reviews_select_group_visible"     on public.reviews;
drop policy if exists "reviews_insert_own_group_visible" on public.reviews;
drop policy if exists "reviews_update_own"               on public.reviews;

create policy reviews_select_relational on public.reviews
  for select using ( public.can_view_review(user_id, restaurant_id) );

create policy reviews_insert_own_private on public.reviews
  for insert with check (
    user_id = auth.uid()
    and visibility = 'private'
    and group_id is null
    and rating between 1 and 4
    and public.can_record_restaurant(restaurant_id)
  );

create policy reviews_update_own on public.reviews
  for update using ( user_id = auth.uid() )
  with check (
    user_id = auth.uid()
    and visibility = 'private'
    and group_id is null
    and rating between 1 and 4
  );

-- Task D: restaurant_accesses private 対応
-- creator 条件なし: マスタ店（created_by=運営）を一般ユーザーが選んだときも private 行を作れるようにする
create policy restaurant_accesses_insert_own_private on public.restaurant_accesses
  for insert with check (
    created_by = auth.uid()
    and visibility = 'private'
    and user_id = auth.uid()
    and group_id is null
  );

create policy restaurant_accesses_select_private on public.restaurant_accesses
  for select using (
    visibility = 'private' and user_id = auth.uid()
  );
