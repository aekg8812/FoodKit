# FoodKit V3 初期デプロイ Runbook

最終更新: 2026-10-19  
対象: `feature/v2-development` → `main` push によるVercel自動デプロイ  
現行Production Commit: `4c402d3`（F3 Batch2）  
Migration: ローカル 63件 / Production適用済み 22件 / **未適用 41件**

---

## 確認済み Production 設定

| 項目 | 値 |
|---|---|
| Production Deployment SHA | `4c402d3` |
| Production Branch | `main`（push時に自動デプロイ） |
| 本番ドメイン | `https://food-kit.vercel.app` |
| Vercel 環境変数 | 5件 登録済み |
| Supabase Auth Site URL | `https://food-kit.vercel.app` |
| Supabase Auth Redirect URL | `https://food-kit.vercel.app/reset-password` |

---

## 事前調査結果サマリ（2026-10-19）

| 確認項目 | 結果 |
|---|---|
| dry-run（41件） | ✅ エラーなし・全件確認済み |
| Production RPC 10件の互換性 | ✅ V3 Migrationで DROP・シグネチャ変更なし |
| ALTER TABLE 全件 | ✅ カラム追加・制約緩和のみ。既存カラム削除なし |
| restaurants INSERT RLS 変更（004800） | ✅ 4c402d3 は source='manual'・external_place_id=NULL のみ INSERT → 条件を満たす |
| Storage bucket 変更 | ✅ restaurant-images を新規追加のみ。既存 bucket の DROP なし |
| ローカルDB 整合性（孤立行・重複） | ✅ 全件クリア |
| can_view_review 変更（002900） | ✅ 意図的仕様変更（後述セキュリティ監査参照） |
| reviews 重複チェック（ローカル） | ✅ 重複ペア 0件 |
| **reviews 重複チェック（Production）** | ⚠️ **Migration 直前に本番 SQL Editor で要実行** |

---

## セキュリティ監査: can_view_review と RLS（2026-10-19 更新）

### ⚠️ BLOCKER — Signup 実装の確認結果

前回の監査報告で「FoodKit は招待制クローズドアプリであり、認証済み = 信頼できるユーザー」と説明したが、**この前提は誤りである**。

実装の確認結果:

- `/signup` は `PUBLIC_PATHS` に含まれ、認証なしでアクセス可能
- フォームは `supabase.auth.signUp({ email, password })` を直接呼び出す
- **招待コード・管理者承認・メール確認なし**（Supabase Auth の `Email Confirm` 設定に依存）
- **誰でもメールアドレスがあれば登録可能**
- グループへの参加は招待制（invite code 必須）だが、**アプリ登録自体は誰でもできる**

### can_view_review の変遷

| Migration | 閲覧可能範囲 |
|---|---|
| 000200（初期） | 自分のレビュー **OR** 同一グループメンバーのレビュー（restaurant_accesses 経由） |
| 000900（follows追加） | 上記 **+** 相互フォロー（友人）のレビュー |
| **002900（V2）** | **auth.uid() IS NOT NULL → 認証済みユーザー全員が全レビューを閲覧可能** |

`reviews_select_relational` ポリシーが `can_view_review` に委譲しており、この1関数の変更が以下すべてに自動適用される:

- `reviews` テーブルの SELECT
- `review-images` Storage の SELECT（`can_view_review_image` → `can_view_review` に委譲）
- `restaurants` の `restaurants_select_via_visible_review` ポリシー（レビュー経由での店舗表示）
- `get_today_restaurants` RPC 内の可視性チェック

### 確認項目

**1. Migration前の閲覧可能範囲（Production現状）**  
自分のレビュー / 同一グループメンバーのレビュー / 相互フォローユーザーのレビュー。  
グループ・フォロー関係がない他アカウントのレビューは閲覧不可。

**2. Migration後の閲覧可能範囲（002900適用後）**  
登録済みアカウントであれば、グループ・フォロー関係に関わらず **全ユーザーの全レビューを閲覧可能**。  
anonymous（未ログイン）は引き続き閲覧不可。

**3. 所属グループ外の他人のレビューを閲覧可能か**  
**YES。** Migration 後、知らないユーザーのアカウントでも、自己登録してログインすれば全レビューを閲覧できる。

**4. レビュー画像への影響**  
`can_view_review_image` は `can_view_review` に委譲しているため、**review-images の signed URL 取得も同様に全認証ユーザーへ拡大する**。

**5. Restaurant visibility との整合性**  
`restaurants_select_via_visible_review` はレビュー可視性の拡大に追従するため、  
レビューが紐づく店舗も全認証ユーザーから閲覧可能になる。

**6. get_restaurant_reviews_v2 との整合性**  
このRPC（003000）は anon guard を持ち、scope='all' で全認証ユーザーのレビューを返す設計。  
Migration後のRLS拡大と整合している。

**7. V2の正式な公開範囲仕様**  
CLAUDE.md には `can_view_review()` が V2 で `auth.uid() IS NOT NULL` を返すと明記されている。  
ただし CLAUDE.md はコード設計の記述であり、**プロダクトとしての公開範囲仕様を承認した記録ではない**。

### セキュリティ監査結論

> **⚠️ BLOCKER — ユーザーの意思決定が必要**
>
> Migration 002900 により、新規登録者を含む全認証済みアカウントが全レビュー・レビュー画像を閲覧可能になる。  
> アプリ登録は誰でも可能であるため、「認証済み = 信頼できる知人」という前提は成立しない。  
> この変更がプロダクト仕様として意図的であるか、デプロイ前にユーザーが判断する必要がある。
>
> **修正 Migration はユーザー承認なしに作成しない。**

選択肢（参考。実施しない）:

| オプション | 内容 |
|---|---|
| A. 現仕様のままデプロイ | 全認証ユーザーが全レビューを閲覧可能と明示的に承認する |
| B. can_view_review を修正 | グループ or フォロー or 自分 の3条件に戻す Migration を追加する（ユーザー承認必須） |
| C. Signup を制限 | invite-only に変更する（Supabase Auth 設定 or コード変更が必要。ユーザー承認必須） |

---

## バックアップ対象範囲と取得方法（Freeプラン準拠）

> **Freeプランの制約**: Supabase Free プランは PITR（Point-in-Time Restore）が無効であり、  
> Dashboard の「Database Backups」も利用できない。バックアップは `supabase db dump` による  
> 手動取得が唯一の手段となる。

### 対象ごとの取得可否と方法

| 対象 | CLIで取得可能か | コマンド / 方法 | 備考 |
|---|---|---|---|
| DB ロール定義（PostgreSQLロール） | ✅ | `--linked --role-only` | |
| public スキーマ DDL（テーブル・関数・RLS等） | ✅ | `--linked`（デフォルト） | |
| public テーブルデータ | ✅ | `--linked --data-only --use-copy` | |
| supabase_migrations 履歴 | ✅ **別途必要** | `--linked --schema supabase_migrations --data-only --use-copy` | デフォルトの `--data-only` には **含まれない**。必ず別コマンドで取得する |
| auth スキーマ DDL | ✅ CLI可 | `--linked --schema auth` | GoTrue管理テーブルを含む。**復元は Supabase 管理スキーマのため非推奨** |
| auth テーブルデータ（auth.users等） | ✅ CLI可 | `--linked --schema auth --data-only --use-copy` | **Free プランでは復元先プロジェクトへの正常な移行が保証されない**。参照用に取得するにとどめる |
| storage スキーマメタデータ（storage.objects等） | ✅ CLI可 | `--linked --schema storage --data-only --use-copy` | バケット内ファイルは含まない |
| **Storage ファイル本体**（avatars・review-images の画像） | ❌ **CLI不可** | Storage API を用いた別スクリプトが必要 | `supabase db dump` はファイルを取得しない |
| Supabase Project 設定（Auth設定・OAuthプロバイダ等） | ❌ **CLI不可** | Dashboard → Settings から手動で記録する | |

### バックアップコマンド（当日実行用・6コマンド）

以下は Migration 適用直前に実行する。

```bash
DATE=$(date +%Y%m%d_%H%M)

# (1) DBロール定義
supabase db dump --linked --role-only \
  -f backup_roles_${DATE}.sql

# (2) public スキーマ DDL（テーブル・関数・RLS・ポリシー）
supabase db dump --linked \
  -f backup_schema_${DATE}.sql

# (3) public テーブルデータ（COPY形式）
supabase db dump --linked --data-only --use-copy \
  -f backup_data_${DATE}.sql

# (4) Migration履歴（デフォルトdata-onlyに含まれないため必須）
supabase db dump --linked --schema supabase_migrations --data-only --use-copy \
  -f backup_migrations_${DATE}.sql

# (5) auth スキーマデータ（参照用。復元は保証されない）
supabase db dump --linked --schema auth --data-only --use-copy \
  -f backup_auth_data_${DATE}.sql

# (6) storage メタデータ（ファイル本体は別途）
supabase db dump --linked --schema storage --data-only --use-copy \
  -f backup_storage_meta_${DATE}.sql
```

完了後の確認:
```bash
ls -lh backup_*_${DATE}.sql
# 全6ファイルが存在し、サイズが 0 でないこと
```

> **Storage ファイル本体について**  
> avatars / review-images の実画像は上記コマンドで取得できない。  
> デプロイ前にファイル本体が失われるリスクは低い（Migration で既存 bucket を DROP しない）が、  
> 完全なバックアップが必要な場合は Supabase Storage API（`/object/list` → `/object/download`）  
> を用いたスクリプトを別途作成すること。

> **保存先**: バックアップファイルには個人情報（auth.users 等）が含まれる。  
> Git リポジトリ管理外の暗号化ストレージに移動すること。  
> `.gitignore` に `backup_*.sql` が含まれることを事前確認する。

### 復元検証（使い捨てQA環境のみ）

> **禁止**:
> - 通常開発 DB（`supabase db reset --local`）への流し込み禁止
> - Production DB への直接流し込み禁止
>
> 復元検証は必ず **完全独立した使い捨て Supabase プロジェクト** で行う。

**手順:**

1. Supabase Dashboard で新規プロジェクトを作成（QA専用・検証後に削除）
2. そのプロジェクトの接続URLを取得し、以下を実行:

```bash
QA_DB_URL="postgresql://postgres:<password>@<qa-host>:5432/postgres"

# ロール → スキーマ → データ → Migration履歴 の順
psql ${QA_DB_URL} < backup_roles_${DATE}.sql
psql ${QA_DB_URL} < backup_schema_${DATE}.sql
psql ${QA_DB_URL} < backup_data_${DATE}.sql
psql ${QA_DB_URL} < backup_migrations_${DATE}.sql
```

**復元成功判定（QA環境の SQL Editor で実行）:**

```sql
-- (1) テーブル件数（本番バックアップ取得時の記録値と一致すること）
SELECT
  (SELECT COUNT(*) FROM public.restaurants) AS restaurants,
  (SELECT COUNT(*) FROM public.reviews)     AS reviews,
  (SELECT COUNT(*) FROM public.users)       AS users;

-- (2) Migration履歴件数（本番の適用済み件数と一致すること）
SELECT COUNT(*) FROM supabase_migrations.schema_migrations;

-- (3) Review 参照整合性（孤立レビューが 0件）
SELECT COUNT(*) FROM public.reviews rv
LEFT JOIN public.restaurants r ON r.id = rv.restaurant_id
WHERE r.id IS NULL;

-- (4) 主要 RPC 疎通（エラーが発生しないこと）
SELECT * FROM public.get_today_restaurants() LIMIT 1;
SELECT public.is_username_available('qa_check_only_xyz');
```

> **Auth 整合性チェックについて**:  
> `auth.users` と `public.users` の結合チェックはQA環境では実行できない  
> （QA プロジェクトの auth.users は空のため）。  
> この検証は本番復元時にのみ意味を持つ。

---

## Production RPC 互換性（4c402d3 × 41件 Migration）

### Production が呼び出す RPC と Migration の影響

| RPC | 4c402d3 の呼び出し元 | V3 Migration の変更 | 判定 |
|---|---|---|---|
| `get_recommendations_filtered` | `/home` | ACL 修正のみ（004100） | ✅ 安全 |
| `get_recommendations_same_type` | `/home` | 変更なし | ✅ 安全 |
| `get_friend_count` | `/mypage`, `/users/[username]` | 変更なし | ✅ 安全 |
| `get_public_landing_stats` | `/` | 変更なし | ✅ 安全 |
| `get_app_stats` | `/stats` | 変更なし | ✅ 安全 |
| `get_daily_stats` | `/stats` | 変更なし | ✅ 安全 |
| `search_users_by_username` | `/friends/search` | 変更なし | ✅ 安全 |
| `join_group_by_invite_code` | `GroupsJoinForm` | 変更なし | ✅ 安全 |
| `delete_group` | `GroupMenu` | 変更なし | ✅ 安全 |
| `is_username_available` | `src/lib/users/username.ts` | 変更なし | ✅ 安全 |

### テーブル・カラム変更の影響

| Migration | 変更種別 | 4c402d3 への影響 |
|---|---|---|
| 001900 | `reviews` に unique(user_id, restaurant_id) 追加 | ✅ 既存コードは1ユーザー1店舗1レビュー前提。**本番重複チェック必須（Step A）** |
| 002000〜003500 | `restaurants` に検索カラム追加（budget・lat/lng・tags等） | ✅ カラム追加のみ。既存クエリに影響なし |
| 002700 | `users` に onboarding_version 追加（DEFAULT 1） | ✅ 4c402d3 で参照なし |
| 003900 | `notifications` テーブル新規追加 | ✅ 4c402d3 で参照なし |
| 004300 | `restaurants` に main_image_path 追加 | ✅ カラム追加のみ |
| 004800 | restaurants INSERT RLS 再設定 | ✅ 4c402d3 は external_place_id=NULL の manual 行のみ INSERT |
| 004900 | `restaurants.name` の NOT NULL 制約を削除 | ✅ 既存行の name は保持。制約の緩和のみ |

---

## デプロイ実行計画

**前提**: Production `4c402d3` との互換性確認済み・バックアップ手順確認済みの状態で実施。  
**必須**: 各 Step の「前提条件」を確認してから次に進む。

---

### Step A — Production 事前チェック（read-only）

**前提条件**: Production DB への read-only アクセス（Supabase SQL Editor）  
**実行者**: デプロイ担当者  
**Migration 前に必ず実施する。**

Supabase Dashboard → SQL Editor（Production）で実行:

```sql
-- 1. reviews 重複チェック
--    0件以外が返った場合は STOP。Migration 001900 が失敗する。
SELECT user_id, restaurant_id, COUNT(*) AS cnt
FROM public.reviews
GROUP BY user_id, restaurant_id
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- 2. 現在のテーブル件数を記録（Migration 後の比較用）
SELECT
  (SELECT COUNT(*) FROM public.restaurants) AS restaurants,
  (SELECT COUNT(*) FROM public.reviews)     AS reviews,
  (SELECT COUNT(*) FROM public.users)       AS users;
```

**成功判定**: reviews 重複クエリが 0件を返すこと  
**失敗時の対応**: 重複が検出された場合は STOP。重複行を特定・手動解消後に再実施する

---

### Step B — バックアップ取得

**前提条件**: Step A 完了（reviews 重複 0件確認済み）  
**実行者**: デプロイ担当者

```bash
DATE=$(date +%Y%m%d_%H%M)
supabase db dump --linked --role-only -f backup_roles_${DATE}.sql
supabase db dump --linked -f backup_schema_${DATE}.sql
supabase db dump --linked --data-only --use-copy -f backup_data_${DATE}.sql

# サイズ確認
ls -lh backup_*_${DATE}.sql
```

バックアップファイルを Git 管理外の暗号化ストレージに移動する。

> **Free プランの制約**: Dashboard の PITR・自動バックアップは利用不可。  
> 上記6コマンドが唯一の手段。Storage ファイル本体は別途 Storage API スクリプトが必要。

**成功判定**: 6ファイルが全て生成され、サイズが 0 でないこと  
**失敗時の対応**: Supabase CLI バージョン確認（推奨: v2.121.0）。`supabase link` の認証状態を確認する

---

### Step C — Migration dry-run（最終確認）

**前提条件**: Step B 完了  
**実行者**: デプロイ担当者

```bash
supabase db push --linked --dry-run
```

**成功判定**: 41件が表示され、エラーメッセージが出ないこと  
**失敗時の対応**: エラー内容を確認し、Migration ファイルを修正してから再度 dry-run

---

### Step D — Production Migration 適用

**前提条件**: Step C 完了（dry-run エラーなし）  
**実行者**: デプロイ担当者

```bash
supabase db push --linked
```

完了後の確認:

```bash
supabase migration list
# 全 63件 に remote マークが付いていること
```

Supabase SQL Editor（Production）で:

```sql
-- restaurant-images バケットが追加されていること
SELECT id, name, public FROM storage.buckets ORDER BY created_at;

-- restaurants 件数が Step A の記録と一致すること（seed データ変化なし）
SELECT COUNT(*) FROM public.restaurants;

-- 主要 RPC が正常応答すること
SELECT public.is_username_available('deploy_check_only_xyz');
```

**成功判定**: migration list で全 63件に remote マーク。バケット確認 OK。件数一致。  
**失敗時の対応**:

| エラー種別 | 対応 |
|---|---|
| reviews unique 制約エラー | STOP。バックアップ保持。重複を解消後、`supabase db push --linked` を再実行（未適用分が続きから実行される） |
| Migration 途中停止 | `supabase migration list` で停止箇所を確認。原因を特定後に再実行 |
| その他 | Step B のバックアップを使用して復元。復元は使い捨てQA環境で手順を検証してから本番適用する |

---

### Step E — Migration 後の動作確認（4c402d3 稼働中）

**前提条件**: Step D 完了  
**目的**: Migration 後も既存の Production コード（4c402d3）が正常に動作することを確認する

`https://food-kit.vercel.app` にブラウザでアクセス:

- [ ] ログインページが表示される
- [ ] ログインが成功し `/home` に遷移する
- [ ] `/home` でレビューフィードおよびおすすめが表示される

**成功判定**: 上記3点がエラーなく動作すること  
**失敗時の対応**: Supabase SQL Editor でエラーログを確認。RPC 疎通を個別に確認する

---

### Step F — GitHub main push（V3 コードデプロイ）

**前提条件**: Step E 完了（4c402d3 + V3 Migration が正常動作確認済み）  
**実行者**: デプロイ担当者（Git 操作）

```bash
git checkout main
git merge feature/v2-development
git push origin main
```

Vercel の Auto Deploy（main branch）が自動起動する。

**失敗時の対応**:

| 失敗種別 | 対応 |
|---|---|
| merge conflict | conflict を解消してから再度 push |
| Vercel build エラー | Vercel Dashboard でログ確認。修正コミットを main に push して再 deploy |
| Vercel deploy タイムアウト | Dashboard から手動で Redeploy |

---

### Step G — Vercel Deploy 完了確認

**前提条件**: Step F 完了  
**実行者**: デプロイ担当者

Vercel Dashboard → Deployments:

- [ ] Status が `Ready` になっていること
- [ ] Deployment SHA が `feature/v2-development` の HEAD と一致すること
- [ ] `https://food-kit.vercel.app` にアクセスし、ページが表示されること

---

### Step H — 本番 Smoke Test

**前提条件**: Step G 完了  
**実行環境**: ブラウザ（375px viewport 推奨）

| # | 確認内容 | 備考 |
|---|---|---|
| 1 | `/login` — ログインページ表示、ログイン成功 | |
| 2 | `/home` — 検索バー・Today CTA・おすすめ・フォロー中記録が表示される | |
| 3 | `/search` — FoodKit Match リンクが表示される | |
| 4 | `/search/today` → `/search/today/results` — フィルタ条件が動作する | |
| 5 | `/groups` — グループ一覧が表示される | |
| 6 | `/mypage` — プロフィール・記録・好みカードが表示される | |
| 7 | `/notifications` — 通知ページが表示される | |
| 8 | 新規レビュー投稿 — 店舗選択 → レビュー入力 → 保存 → 一覧反映 | |
| 9 | `/forgot-password` — メール送信成功。`/reset-password` へ正常リダイレクト | Auth Redirect URL 確認 |

**失敗時の対応**:

| 症状 | 対応 |
|---|---|
| 認証ページが表示されない・リダイレクトループ | Supabase Auth Site URL を確認 |
| `/home` で RPC エラー | Vercel 環境変数・Supabase project ref を確認 |
| `/reset-password` へのリダイレクト失敗 | Auth Redirect URL の設定を確認 |
| 全ページで 500 エラー | Vercel ログ確認。必要に応じて前の deploy に rollback |

---

## デプロイ後 フォローアップ（緊急度低）

| 項目 | 内容 |
|---|---|
| restaurant metadata 未一致チェック | Production DB で `budget_per_person_max_yen IS NULL` の seed 店舗を確認。未一致があれば補完 UPDATE を実施 |
| `ふくろう` 店舗の同一性確認 | VERIFY_IDENTITY フラグ。確認後に補完 UPDATE または追加 Migration で対処 |

---

## DEPLOY READY 判定

| チェック項目 | 状態 |
|---|---|
| dry-run 41件エラーなし | ✅ 確認済み |
| Production RPC 10件 互換性 | ✅ DROP・変更なし |
| ALTER TABLE — 破壊的変更なし | ✅ カラム追加・制約緩和のみ |
| ローカル DB 整合性 | ✅ クリア |
| Vercel 設定・Auth URL | ✅ 確認済み |
| バックアップ手順（6コマンド・Freeプラン準拠） | ✅ 本 Runbook に記載済み |
| 復元検証手順（使い捨て QA 環境） | ✅ 本 Runbook に記載済み |
| **Production reviews 重複チェック** | ⚠️ Step A で Migration 直前に実施（ローカルは 0件確認済み） |
| **can_view_review × Signup 公開範囲** | ✅ **V3正式仕様として承認済み（2026-10-19）** |
| **公開範囲説明 UI（3フォーム）** | ✅ 実装・ビルド確認済み |

### 最終判定: **GO — Step A へ進める**

**残タスク（デプロイ前）:**

1. **Step A — Production reviews 重複チェック**（Migration 直前に実施）

---

## V4 移行時の注意事項 — visibility カラムと RLS の乖離

### 現状 (V3)

`reviews` テーブルの `visibility` カラムは `'private'` で INSERT される（`ReviewForm.tsx`・`RecordFormClient.tsx`・`GooglePlaceRecordForm.tsx` すべて同じ）。  
しかし SELECT RLS ポリシー `reviews_select_relational` は `can_view_review()` に委譲しており、V3 では `auth.uid() IS NOT NULL` を返す。  
**結果:** `visibility='private'` であっても、認証済みユーザーは全レビューを閲覧できる。カラム値と実際のアクセス制御が乖離している。これは V3 の意図的な仕様。

### V4 で解消する際の手順

1. `can_view_review` 関数を `visibility` カラムを参照する実装に戻す新 Migration を作成する  
   例: `visibility='public'` → 全認証ユーザー / `visibility='friends_group'` → フォロー関係 / `visibility='private'` → 本人のみ

2. INSERT 側は `visibility` をユーザー選択可能にする（フォーム UI の追加）

3. `review_images` Storage RLS と `restaurants_select_via_visible_review` は `can_view_review` 委譲のため、関数変更のみで自動追随する（追加 Migration 不要の可能性が高い）

4. FoodKit Match（`get_my_foodkit_matches`）が `visibility` を考慮すべきか別途検討する

5. 既存レビュー（現在 `visibility='private'`）をどのデフォルト範囲に移行するかユーザーへ確認してから Migration を実行する

### 影響ファイル（V4 着手時に確認）

- `supabase/migrations/20261007002900_v2_can_view_review.sql` — 関数定義を置き換える新 Migration を追加
- `src/app/record/[restaurantId]/RecordFormClient.tsx` — visibility 選択 UI 追加
- `src/app/restaurants/[id]/ReviewForm.tsx` — visibility prop 追加
- `src/app/record/place/[placeId]/GooglePlaceRecordForm.tsx` — visibility 選択 UI 追加
- `src/app/settings/page.tsx` — デフォルト公開範囲設定セクション追加
