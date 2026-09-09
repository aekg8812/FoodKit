-- ============================================================
-- F1 追加分: 起動画面（未ログイン）に出す公開用の実績値
-- 担当: すがけん / レビュー: あやと
-- 番号は事前予約制。000900 は A3（follows）が使用済みのため 001000 を使う。
--
-- get_app_stats()（20260809000400）には一切触らない。
--   あちらは authenticated 限定という確定事項があり、anon 拒否も検証済み。
--   公開用の見せ方は、返す列を絞った別関数として追加する。
--
-- 返す列を2つに絞っているのは意図的。アクティブ数のような内部指標は、
--   集計値であっても起動画面に出す理由がない。
--
-- users / restaurants には RLS がかかっており anon からは数えられないため、
--   ここでも security definer で定義者権限に切り替える。
--   返すのは件数だけで、個票は返さない。
-- ============================================================
create or replace function public.get_public_landing_stats()
returns table (
  total_users              bigint,
  total_restaurants_manual bigint
)
language sql
stable
security definer
-- pg_temp を明示しないと一時テーブルによる名前解決の割り込み余地が残る。
-- 既存の security definer 関数（can_view_review / is_username_available /
-- get_app_stats）と書き方を揃えている。
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.users),
    -- 運営投入の店舗マスタ（source='seed'）は実績ではないため除く
    (select count(*) from public.restaurants where source = 'manual');
$$;

comment on function public.get_public_landing_stats() is
  '起動画面に出す公開用の実績値。未ログインから呼ばれるため anon にも実行権限を与える（件数のみ）。';

-- 未ログインの起動画面から呼ぶため anon にも GRANT する。
revoke all on function public.get_public_landing_stats() from public;
grant execute on function public.get_public_landing_stats() to anon, authenticated;
