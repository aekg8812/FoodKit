-- G1: 運営投入の店舗マスタ（source='seed'）を全認証ユーザーに公開する
-- 店名・エリア・ジャンル・住所のみの公開情報。
-- レビューの可視性は can_view_review が握っており、このポリシーの影響を受けない。

create policy restaurants_select_seed on public.restaurants
for select
to authenticated
using ( source = 'seed' );