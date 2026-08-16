-- ============================================================
-- E1: ユーザーID（ハンドル）機能
-- 担当: 綾部 / レビュー: あやと
-- 番号は事前予約制（あやと配布）。既存マイグレーションは編集しない。
--
-- このマイグレーションは RLS ポリシーを一切変更しない。
--   users_update_own ポリシー ........... 20260707000200 に既存
--   grant update on public.users ........ 20260707000500 に既存
-- ID変更（F2）に必要な権限は両レイヤーとも揃っているため追加不要。
-- ============================================================


-- ------------------------------------------------------------
-- 1. 予約語判定
--    CHECK制約から呼ぶため immutable であることが必須。
--    アプリのルートと衝突する語を禁止する（/users/[username] 等）。
-- ------------------------------------------------------------
create or replace function public.is_username_reserved(p_username text)
returns boolean
language sql
immutable
as $$
  select lower(p_username) in (
    'admin','administrator','root','system','support','help','api','auth',
    'login','signup','logout','settings','home','mypage','groups','group',
    'restaurants','restaurant','onboarding','foodkit','official',
    -- V1 で追加されるルート
    'users','user','friends','stats',
    -- 将来のフォロー関連ページ
    'follow','following','followers',
    'null','undefined'
  );
$$;


-- ------------------------------------------------------------
-- 2. カラム追加 → 既存ユーザーへ仮ID付与 → NOT NULL 化
--    先に NOT NULL を付けると既存行が通らないため、この順序で行う。
-- ------------------------------------------------------------
alter table public.users add column username text;

do $$
declare
  r record;
  candidate text;
begin
  for r in select id from public.users where username is null loop
    loop
      candidate := 'user_' || substr(md5(random()::text), 1, 8);
      exit when not exists (
        select 1 from public.users where lower(username) = lower(candidate)
      );
    end loop;
    update public.users set username = candidate where id = r.id;
  end loop;
end $$;

alter table public.users alter column username set not null;


-- ------------------------------------------------------------
-- 3. 制約・インデックス（DB側が最後の砦。フロントの検証は突破されうる）
-- ------------------------------------------------------------

-- 文字種と長さ: 英数字 + _ . - の3〜20文字
-- '+' は URL でスペースに解釈されるため許可しない
alter table public.users
  add constraint users_username_format_check
  check (username ~ '^[A-Za-z0-9_.-]{3,20}$');

alter table public.users
  add constraint users_username_not_reserved
  check (not public.is_username_reserved(username));

-- 大文字小文字を区別しない一意性（Ayato と ayato は同一とみなす）
-- 表示は入力どおり、判定のみ小文字化。citext 拡張は使わない。
create unique index users_username_lower_unique
  on public.users (lower(username));

-- 前方一致検索用。text_pattern_ops がないと非C照合順序で
-- like 'foo%' がインデックスを使えない。
create index users_username_lower_prefix_idx
  on public.users (lower(username) text_pattern_ops);


-- ------------------------------------------------------------
-- 4. 空き確認（登録フォームの即時チェック用）
--    未ログイン状態の /signup から呼ぶため anon にも GRANT する。
-- ------------------------------------------------------------
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_username ~ '^[A-Za-z0-9_.-]{3,20}$'
    and not public.is_username_reserved(p_username)
    and not exists (
      select 1 from public.users
      where lower(username) = lower(p_username)
        -- 自分の現在のIDは「空き」扱い（F2 のID変更フォームで自分自身に弾かれないように）。
        -- anon から呼ばれたときは auth.uid() が null になり、この条件は常に真になる。
        and id is distinct from auth.uid()
    );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;


-- ------------------------------------------------------------
-- 5. ユーザー検索
--    users テーブルを他人に SELECT 開放すると、将来カラムが増えたときに
--    芋づる式で漏れる。必要な列だけを返す関数に閉じる。
--    email は返さない。
-- ------------------------------------------------------------
create or replace function public.search_users_by_username(p_query text)
returns table (id uuid, username text, name text, main_value_type text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id, u.username, u.name, p.main_value_type::text
  from public.users u
  left join public.user_value_profiles p on p.user_id = u.id
  -- 2文字未満は0件。全件列挙を防ぐ。
  where length(trim(p_query)) >= 2
    -- 前方一致のみ。部分一致（%foo%）はインデックスが効かず、
    -- 総当たりで他人を列挙されやすい。
    --
    -- '_' はユーザーIDに使える文字であると同時に LIKE のワイルドカード
    -- （任意の1文字）でもあるため、エスケープしないと ayato_k で ayatoXk が
    -- ヒットする。置換は \ → % → _ の順で行うこと。'_' を先に置換すると
    -- そこで挿入した '\' を後段の '\' 置換が再度エスケープし、二重エスケープで壊れる。
    and lower(u.username) like
        replace(replace(replace(lower(trim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        escape '\'
    -- 自分は結果に出さない
    and u.id <> auth.uid()
  order by length(u.username), lower(u.username)
  limit 20;
$$;

revoke all on function public.search_users_by_username(text) from public;
grant execute on function public.search_users_by_username(text) to authenticated;


-- ------------------------------------------------------------
-- 6. 登録トリガーの更新
--    20260707000400 の定義をベースに username の受け取りを追加する。
--    トリガー on_auth_user_created は関数名を参照しているため再作成は不要。
--
--    未指定 / 不正 / 予約語 / 使用済み の場合は例外を投げず仮IDにフォールバックする。
--    ここで例外を投げると auth.users への INSERT ごとロールバックされ、
--    ユーザーには「登録できません」としか出せなくなる。フォームで事前チェック
--    しているため、ここに到達する重複は同時登録の競合のみ。登録は通し、
--    後から変更してもらう方が事故が小さい。
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_username text;
begin
  v_username := new.raw_user_meta_data->>'username';

  if v_username is null
     or v_username !~ '^[A-Za-z0-9_.-]{3,20}$'
     or public.is_username_reserved(v_username)
     or exists (select 1 from public.users where lower(username) = lower(v_username))
  then
    loop
      v_username := 'user_' || substr(md5(random()::text), 1, 8);
      exit when not exists (
        select 1 from public.users where lower(username) = lower(v_username)
      );
    end loop;
  end if;

  insert into public.users (id, email, name, username, value_type, onboarding_completed, profile_completion)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    v_username,
    null,
    false,
    0
  )
  on conflict (id) do nothing;

  insert into public.user_value_profiles (user_id, main_value_type, scores_json, confidence, profile_completion)
  values (
    new.id,
    null,
    '{"cost":0,"taste":0,"atmosphere":0,"hospitality":0}'::jsonb,
    0,
    0
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;
