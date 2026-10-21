# FoodKit V2 — Final Integration QA Checklist

All items require a real browser at **375px viewport** (iPhone SE / Responsive DevTools).
Mark each item `[x]` when verified.

---

## Auth

- [ ] `/login` — フォーム表示、"パスワードを忘れた方" リンク visible
- [ ] `/login` — 正しい認証情報でログイン → `/home` へ遷移
- [ ] `/login` — 誤ったパスワードでエラーメッセージ表示
- [ ] `/signup` — アカウント作成 → `/onboarding` → `/onboarding/preferences` (V2 preference card 選択)
- [ ] `/onboarding/preferences` — 4枚以下で保存 → エラー（5枚以上必須）
- [ ] `/onboarding/preferences` — 5枚以上選択して保存 → `/home` へ遷移
- [ ] `/forgot-password` — メールアドレス入力 → enumeration-safe 成功メッセージ
- [ ] PKCE recovery flow:
  - [ ] `/forgot-password` でメール送信
  - [ ] 受信メールのリンクをクリック → `/reset-password?code=...`
  - [ ] `PASSWORD_RECOVERY` event 発火 → フォーム有効化
  - [ ] 新しいパスワード入力 → 保存
  - [ ] 旧パスワードでログイン → 失敗
  - [ ] 新パスワードでログイン → 成功
- [ ] `/reset-password` — コードなし / 期限切れで直接アクセス → "リンク無効" 状態表示

---

## Home

- [ ] `/home` — 検索バー、Today CTA、フォロー中記録プレビュー(3件)、おすすめプレビュー(5件)、グループ、通知ベルバッジ
- [ ] `/home` — 通知ベルバッジ: 未読あり → 赤ドット表示
- [ ] `/home/following-records` — フォロー中ユーザーの記録一覧、created_at DESC 順
- [ ] `/home/following-records` — フォロー中0人 → "ユーザーを探す" empty state
- [ ] `/home/recommendations` — evidence バッジ付きおすすめ一覧
- [ ] `/home/recommendations` — empty state → 2つの CTA ボタン

---

## Search

- [ ] `/search` — 検索バー、エリア・ジャンルフィルタ
- [ ] 検索結果 → 店舗詳細へ遷移

---

## Today (Home → 今日の条件)

- [ ] `/home` の Today CTA 表示
- [ ] 条件フィルタ (エリア / ジャンル / 予算) 適用 → 結果変化
- [ ] **DATA GAP**: 予算フィルタは `budget_per_person_max_yen` が全店舗 NULL のため 0 件になる（data 投入後に再検証）

---

## Restaurant

- [ ] `/restaurants/[id]` — 店舗名、エリア、ジャンル、住所 表示
- [ ] `/restaurants/[id]` — レビュータブ (みんな / 好みが近い人 / フォロー中) 切替
- [ ] `/restaurants/[id]` — 自分のレビューなし → "記録を追加" CTA
- [ ] `/restaurants/[id]` — 自分のレビューあり → "記録を編集" CTA
- [ ] `/restaurants/new` — 店舗登録フォーム → 登録 → 店舗詳細へ
- [ ] `/restaurants/[id]/ReviewForm` — 評価 1-4 選択、コメント、日付、写真アップロード
- [ ] `/records/[id]` — 自分の記録: 編集 CTA visible; 他人の記録: 編集 CTA 非表示

---

## Records (記録)

- [ ] `/records/[id]` — 記録詳細: 評価バッジ、コメント、日付、画像
- [ ] `/records/[id]/edit` — 編集フォーム: 評価・コメント・日付・画像、保存ボタン、キャンセルリンク
- [ ] 画像アップロード:
  - [ ] 新規記録に写真を添付 → review-images bucket に保存
  - [ ] 記録編集で写真を差し替え → 旧画像削除、新画像保存
  - [ ] 記録編集で写真を削除 → image_path = NULL

---

## Users

- [ ] `/users/[username]` — 他ユーザープロフィール: アバター、名前、username、レビュー数
- [ ] `/users/[username]` — フォロー / フォロー解除ボタン動作
- [ ] `/mypage/follows/search` — ユーザー名検索 (2文字以上)、フォロー/フォロー解除

---

## Groups

- [ ] `/groups` — グループ一覧
- [ ] `/groups/[id]` — グループ詳細: メンバーstrip、preference summary、recommendation リンク
- [ ] `/groups/[id]/members` — メンバー一覧
- [ ] `/groups/[id]/invite` — 招待ページ: copy / LINE / share ボタン
- [ ] `/groups/[id]/recommendations` — 条件なし結果
- [ ] `/groups/[id]/recommendations/conditions` — 条件フォーム (全チップセクション)
- [ ] `/groups/[id]/recommendations/results` — 結果一覧
- [ ] **DATA GAP**: party / atmosphere / walk_in / parking / meal / open_now フィルタは全店舗 NULL のため 0 件になる（data 投入後に再検証）

---

## Notifications

- [ ] `/notifications` — all / unread タブ、未読ドット、クリックで既読化、"すべて既読" ボタン
- [ ] タブ URL 状態: `?tab=all` / `?tab=unread`

---

## Mypage

- [ ] `/mypage` — アバター、名前、username、レビュー数、最近の記録、preference card チップ、フォロー/フォロワー数、設定リンク
- [ ] `/mypage/records` — sort タブ、rating filter タブ、記録カード、empty state
- [ ] `/mypage/follows` — フォロー中 / フォロワー タブ切替
- [ ] Avatar browser QA:
  - [ ] `/mypage/profile/edit` — 実ファイルをアップロード
  - [ ] `/mypage` — アバター反映
  - [ ] `/users/[username]` — アバター反映
  - [ ] グループメンバーストリップ — アバター反映
  - [ ] 通知 — アバター反映

---

## Settings

- [ ] `/settings` — account セクション (username / password リンク)、legal セクション ("準備中" ボタン disabled)、ログアウト (BottomSheet 確認)
- [ ] `/settings/password` — 現在のパスワード入力、新しいパスワード + 確認、保存ボタン
- [ ] `/settings/password` — 誤った現在のパスワード → エラー、更新されない
- [ ] `/settings/username` — username フィールド、バリデーション、成功 → `/settings`
- [ ] `/settings` → ログアウト → `/login`

---

## BottomNav (全画面共通)

- [ ] 5タブ全て 375px で visible かつ tap 可能
- [ ] `/home` → ホームタブ active
- [ ] `/search` → 検索タブ active
- [ ] `/restaurants/new` → 記録タブ active
- [ ] `/groups` → グループタブ active
- [ ] `/mypage` → マイページタブ active
- [ ] `/settings` → マイページタブ active
- [ ] `/settings/**` → マイページタブ active

---

## 375px Layout (全画面)

- [ ] 横 overflow なし
- [ ] BottomNav と本文の overlap なし (pb-20 確認)
- [ ] ボタンの tap ターゲット ≥ 44px
- [ ] テキストが viewport 外にクリッピングされていない
- [ ] BottomSheet / modal 正常表示
- [ ] キーボード表示時にフォーム操作可能

---

## Production Auth Preflight

> **実操作禁止。** Supabase Dashboard での手動設定が必要。

- [ ] Production Supabase Dashboard → Authentication → URL Configuration:
  - Site URL: `https://<production-domain>.vercel.app`
  - Redirect URLs に追加:
    - `https://<production-domain>.vercel.app/reset-password`
    - (Preview deploy 用) `https://*-<project-slug>.vercel.app/reset-password`
- [ ] 設定後、本番環境で forgot-password → メール → `/reset-password` の動作確認

---

## Production Migration Preflight

> **実pushは禁止。** 適用前に以下を確認してから `supabase db push --linked` を実行。

- [ ] `supabase migration list --linked` でリモート最終が `20260913001800` であること確認
- [ ] Local-only 差分が以下 23 件であること確認:
  ```
  20261005001900 〜 20261007004100
  ```
- [ ] 本番適用は staging / preview で先に検証することを推奨
- [ ] 適用後 `supabase migration list --linked` で全 45 件が remote 済みであること確認

---

## Production Env Preflight

- [ ] Vercel 環境変数 (本番プロジェクト) に以下が設定済み:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` が Vercel に存在しないこと (client bundle 混入防止)

---

## DATA GAP — Release Blocked Items

以下のフィルタは **全 53 店舗で対象フィールドが NULL** のため、条件を指定すると必ず 0 件になる。
`docs/restaurant_coverage_check.sql` で進捗を確認できる。

| Filter | Field | Status |
|---|---|---|
| 距離 | `lat` / `lng` | RELEASE BLOCKER |
| 予算 | `budget_per_person_max_yen` | RELEASE BLOCKER |
| 人数 | `party_size_tags` | RELEASE BLOCKER |
| 雰囲気 | `atmosphere_tags` | RELEASE BLOCKER |
| 徒歩圏内 | `walk_in_available` | RELEASE BLOCKER |
| 駐車場 | `parking_available` | RELEASE BLOCKER |
| 食事タイミング | `meal_period_tags` | RELEASE BLOCKER |
| 営業中 | `business_hours_known` / `restaurant_business_hours` | RELEASE BLOCKER |

解消手順:
1. `docs/restaurant_metadata_template.csv` に実データを記入 (人間が確認した値のみ)
2. `docs/restaurant_metadata_update.sql` の UPDATE 文を実行
3. `docs/restaurant_coverage_check.sql` でカバレッジ再確認
4. 全フィルタ `ready_count > 0` を確認後、RELEASE BLOCKER 解除

---

*このファイルは MILESTONE 5〜8 の CLAUDE.md 記載 375px smoke test を統合したものです。*
