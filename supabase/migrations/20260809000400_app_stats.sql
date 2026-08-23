-- ============================================================
-- F1: データ計測（登録者数・レビュー数・アクティブ数）
-- 担当: すがけん / レビュー: あやと
-- 番号は事前予約制（あやと配布）。既存マイグレーションは編集しない。
--
-- このマイグレーションは既存のテーブル・ポリシー・GRANT を一切変更しない。
-- 追加するのは security definer の集計関数2本だけ。
--
-- なぜ security definer が必要か:
--   reviews の SELECT は can_view_review()（20260809000200）が握っているため、
--   authenticated から count(*) を投げても「自分に見える行」しか数えられない。
--   全体の実数を返すには定義者権限で RLS をバイパスする必要がある。
--   そのぶん、返すのは件数だけに限定する。ユーザー名・メール・レビュー本文
--   などの個票は絶対に返さない。
-- ============================================================


-- ------------------------------------------------------------
-- 1. サマリー
--
-- total_restaurants と total_restaurants_manual を分けている理由:
--   G1（20260809000701）で運営投入の店舗マスタ（source='seed'）が50件入っている。
--   count(*) だけだとユーザーが0人でも「登録店舗数 50」になり、実績値として
--   誤解を招く。ユーザーが実際に足した店は source='manual' のみ。
--
-- 期間指定（*_7d）は now() からの相対時間で判定するためタイムゾーン変換は不要。
-- 「日付でバケットに分ける」get_daily_stats とは別問題なので混同しないこと。
-- ------------------------------------------------------------
create or replace function public.get_app_stats()
returns table (
  total_users              bigint,
  total_reviews            bigint,
  total_restaurants        bigint,
  total_restaurants_manual bigint,
  active_users_7d          bigint,
  new_users_7d             bigint,
  new_reviews_7d           bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.users),
    (select count(*) from public.reviews),
    (select count(*) from public.restaurants),
    (select count(*) from public.restaurants where source = 'manual'),
    -- アクティブ数: 直近7日にレビューを投稿したユニークユーザー数
    (select count(distinct user_id) from public.reviews
      where created_at >= now() - interval '7 days'),
    (select count(*) from public.users
      where created_at >= now() - interval '7 days'),
    (select count(*) from public.reviews
      where created_at >= now() - interval '7 days');
$$;

comment on function public.get_app_stats() is
  'V1 データ計測のサマリー。RLS をバイパスして全体の実数を返す（件数のみ・個票は返さない）。';

revoke all on function public.get_app_stats() from public;
grant execute on function public.get_app_stats() to authenticated;


-- ------------------------------------------------------------
-- 2. 日別推移
--
-- 日付バケットは JST（Asia/Tokyo）で切る。
--   created_at は timestamptz、DBのタイムゾーンは UTC。そのまま ::date すると
--   日本時間の 00:00〜09:00 の投稿が前日に入り、グラフが1日ズレる。
--
-- generate_series で日付を先に作っているのは、0件の日を欠落させず 0 として
--   出すため。group by だけで書くと投稿のない日が行ごと消えてグラフが飛ぶ。
--
-- p_days は authenticated なら誰でも渡せるため 1〜90 に丸める。
--   丸めないと巨大な値で日数ぶんのスキャンを走らせられる。
-- ------------------------------------------------------------
create or replace function public.get_daily_stats(p_days int default 14)
returns table (day date, new_users bigint, new_reviews bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with bounds as (
    select
      least(greatest(coalesce(p_days, 14), 1), 90) as span,
      (now() at time zone 'Asia/Tokyo')::date      as today
  ),
  days as (
    select generate_series(
      b.today - (b.span - 1),
      b.today,
      interval '1 day'
    )::date as day
    from bounds b
  )
  select
    d.day,
    (select count(*) from public.users u
      where (u.created_at at time zone 'Asia/Tokyo')::date = d.day),
    (select count(*) from public.reviews r
      where (r.created_at at time zone 'Asia/Tokyo')::date = d.day)
  from days d
  order by d.day;
$$;

comment on function public.get_daily_stats(int) is
  'V1 データ計測の日別推移。日付バケットは JST。0件の日も行として返す。p_days は 1〜90 に丸める。';

revoke all on function public.get_daily_stats(int) from public;
grant execute on function public.get_daily_stats(int) to authenticated;
