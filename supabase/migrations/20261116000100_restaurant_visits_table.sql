-- ============================================================
-- Phase A-1: restaurant_visits テーブル新設
-- ============================================================
-- 目的: 1ユーザー1店舗で複数の来店履歴を保持する。
--       reviews テーブルは引き続き代表評価として維持する。
--       RPC・バックフィル・フォーム変更は Phase A-2 以降。
--
-- SECURITY DEFINER 関数の注意（将来追加する upsert_visit / delete_visit 用）:
--   これらの関数は RLS をバイパスするため、必ず以下を関数内で行うこと:
--     1. auth.uid() が NULL でないことを確認
--     2. p_visit_id が指定された p_user_id・p_restaurant_id に属することを確認
--   RLS は直接クライアントアクセスへの防御層として機能する。

-- ----------------------------------------------------------------
-- テーブル定義
-- ----------------------------------------------------------------

CREATE TABLE public.restaurant_visits (
  id                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  user_id                uuid                     NOT NULL,
  restaurant_id          uuid                     NOT NULL,

  -- 来店日。新規記録では必須とするが、NULL は移行データのみ許容する。
  -- アプリレベルの NOT NULL 強制は upsert_visit RPC（Phase A-2）で行う。
  visit_date             date,

  rating                 integer                  NOT NULL,
  comment                text,
  image_path             text,
  reason_keys            text[]                   NOT NULL DEFAULT '{}',
  label_keys             text[]                   NOT NULL DEFAULT '{}',

  -- 二重送信防止用キー。スコープは (user_id, restaurant_id, key) の組み合わせ。
  -- 詳細は後述の UNIQUE インデックスを参照。
  client_idempotency_key uuid,

  -- 移行元 reviews.id。バックフィル（Phase A-2）で設定する。
  -- 移行前は全行 NULL で、UNIQUE 制約は NULL を重複とみなさないため問題なし。
  legacy_review_id       uuid,

  created_at             timestamp with time zone NOT NULL DEFAULT now(),
  updated_at             timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT restaurant_visits_pkey
    PRIMARY KEY (id),

  CONSTRAINT restaurant_visits_user_fk
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE,

  CONSTRAINT restaurant_visits_restaurant_fk
    FOREIGN KEY (restaurant_id)
    REFERENCES public.restaurants(id)
    ON DELETE CASCADE,

  -- legacy_review_id が削除された場合は NULL にクリア（来店履歴は残す）
  CONSTRAINT restaurant_visits_legacy_review_fk
    FOREIGN KEY (legacy_review_id)
    REFERENCES public.reviews(id)
    ON DELETE SET NULL,

  CONSTRAINT restaurant_visits_rating_check
    CHECK (rating >= 1 AND rating <= 4),

  -- 未来の来店日を拒否（日本時間基準）
  -- STABLE 関数は CHECK 制約で使用可。式インデックスとは異なり IMMUTABLE は不要。
  -- 既存行は UPDATE 時にも再評価されるが、過去日は常に条件を満たすため安全。
  CONSTRAINT restaurant_visits_no_future_date
    CHECK (
      visit_date IS NULL
      OR visit_date <= (now() AT TIME ZONE 'Asia/Tokyo')::date
    ),

  -- NULL は複数可（移行前は全行 NULL）。非 NULL は一意。
  CONSTRAINT restaurant_visits_legacy_unique
    UNIQUE (legacy_review_id)
);

-- ----------------------------------------------------------------
-- インデックス
-- ----------------------------------------------------------------

-- 代表来店決定クエリおよびユーザー来店一覧（logbook）用:
--   WHERE user_id = $uid [AND restaurant_id = $rid]
--   ORDER BY visit_date DESC NULLS LAST, created_at DESC, id DESC
--
-- visit_date NULL は最後尾（NULLS LAST）とする。
-- id を末尾に加えることで、created_at が同値の行も決定論的に順序付けられる。
-- 式インデックスは使用しない（STABLE 関数は IMMUTABLE 要件を満たさないため）。
CREATE INDEX restaurant_visits_user_restaurant_date_idx
  ON public.restaurant_visits
  USING btree (user_id, restaurant_id, visit_date DESC NULLS LAST, created_at DESC, id DESC);

-- 二重送信防止:
--   スコープを (user_id, restaurant_id, key) に限定することで:
--     - 別ユーザーが同一 UUID を生成した場合でも混同しない
--     - 同一ユーザーが別店舗に同一 UUID を使っても混同しない
--   NULL は除外（新規来店でキーを省略した場合は重複チェック対象外）
CREATE UNIQUE INDEX restaurant_visits_idempotency_idx
  ON public.restaurant_visits (user_id, restaurant_id, client_idempotency_key)
  WHERE client_idempotency_key IS NOT NULL;

-- ----------------------------------------------------------------
-- RLS（Row Level Security）
-- ----------------------------------------------------------------

ALTER TABLE public.restaurant_visits ENABLE ROW LEVEL SECURITY;

-- SELECT: 自分の来店履歴のみ閲覧可
CREATE POLICY "visits_select_own"
  ON public.restaurant_visits
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: 自分の来店として挿入のみ可
CREATE POLICY "visits_insert_own"
  ON public.restaurant_visits
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: 所有者確認 + user_id / restaurant_id の変更を禁止
--   USING  → 更新対象行が自分のものであること（旧値検証）
--   WITH CHECK → 更新後も自分の行であること（新値検証）
--             かつ restaurant_id が変更されていないこと
--   サブクエリは visits_select_own ポリシーの下で実行される
--   （自分の行のみ読めるため、他ユーザーの restaurant_id は取得不可）
CREATE POLICY "visits_update_own"
  ON public.restaurant_visits
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND restaurant_id = (
      SELECT rv.restaurant_id
      FROM public.restaurant_visits rv
      WHERE rv.id = restaurant_visits.id
    )
  );

-- DELETE: 自分の来店履歴のみ削除可
CREATE POLICY "visits_delete_own"
  ON public.restaurant_visits
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ----------------------------------------------------------------
-- updated_at 自動更新トリガー
-- ----------------------------------------------------------------

CREATE TRIGGER set_restaurant_visits_updated_at
  BEFORE UPDATE ON public.restaurant_visits
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
