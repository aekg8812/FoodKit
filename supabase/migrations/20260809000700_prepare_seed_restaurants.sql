-- G1: 店舗マスタ投入のDB準備
-- 新しいenum値は追加したトランザクション内で使用できないため、
-- 店舗データのINSERTは20260809000701へ分離する。

alter type public.restaurant_source add value if not exists 'seed';

-- seed店舗は特定の一般ユーザーが作成したものではないためNULLを許可する。
alter table public.restaurants
  alter column created_by drop not null;

-- seed店舗用SELECTポリシーはRLS管理担当が別マイグレーションで追加する。
