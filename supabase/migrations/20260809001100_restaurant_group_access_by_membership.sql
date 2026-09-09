-- A3設計書14章・G2からの指摘を受けた対応
-- 既存の restaurant_accesses group INSERT ポリシーは
-- is_restaurant_creator(restaurant_id) を条件にしていたため、
-- created_by が null の seed 店舗（G1）をグループ共有できなかった。
-- 作成者チェックを「共有先グループのメンバーか」に置き換える。

drop policy if exists restaurant_accesses_insert_creator_group on public.restaurant_accesses;

create policy restaurant_accesses_insert_own_group on public.restaurant_accesses
for insert
to authenticated
with check (
  created_by = auth.uid()
  and visibility = 'group'
  and group_id is not null
  and user_id is null
  and is_group_member(group_id)
);