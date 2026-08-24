import { createClient } from '@/lib/supabase/client'

/**
 * ユーザーID（ハンドル）の共通モジュール — E1
 *
 * ユーザーIDのバリデーションは必ずここを使うこと。
 * F2（設定画面のID変更）・E2（ユーザー検索）から import される共通部品で、
 * 各画面が独自にルールを持つと DB の CHECK 制約とずれて二重管理になる。
 *
 * 使い方:
 *   validateUsernameFormat(value)  形式チェック（同期）。エラー文言 or null
 *   await checkUsernameAvailable(value)  空きをDBに問い合わせる（非同期）
 *   usernameErrorMessage(error.code)  UPDATE 失敗時のエラーを日本語に変換
 *
 * DB側の最後の砦は 20260809000300_add_username.sql の
 * users_username_format_check / users_username_not_reserved /
 * users_username_lower_unique。ここの定数と必ず一致させること。
 */

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

/** DB の users_username_format_check と同一のルール */
export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,20}$/

/**
 * 形式エラーの日本語メッセージを返す。問題なければ null。
 * 予約語と重複はDBに問い合わせないと判定できないため、ここでは見ない。
 */
export function validateUsernameFormat(value: string): string | null {
  if (value.length < USERNAME_MIN || value.length > USERNAME_MAX) {
    return `${USERNAME_MIN}文字以上${USERNAME_MAX}文字以内で入力してください`
  }
  if (!USERNAME_PATTERN.test(value)) {
    return '使えるのは半角英数字と _ . - だけです'
  }
  return null
}

/**
 * ユーザーIDが使えるかDBに問い合わせる（形式・予約語・重複をまとめて判定）。
 * is_username_available は anon にも GRANT されているため未ログインでも呼べる。
 * 大文字小文字は区別しない（Ayato と ayato は同一とみなされる）。
 */
export async function checkUsernameAvailable(value: string): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('is_username_available', {
    p_username: value,
  })

  if (error) {
    console.error(
      'checkUsernameAvailable failed',
      error.message,
      error.code,
      error.details,
      error.hint,
    )
    throw error
  }

  return data === true
}

/**
 * users.username の UPDATE / INSERT が失敗したときの日本語メッセージ。
 * フォームで事前チェックしていても、同時更新の競合で 23505 は起こりうる。
 */
export function usernameErrorMessage(code?: string): string {
  // unique_violation: users_username_lower_unique
  if (code === '23505') return 'このユーザーIDは既に使われています'
  // check_violation: users_username_format_check / users_username_not_reserved
  if (code === '23514') return 'このユーザーIDは使用できません'
  return 'ユーザーIDの変更に失敗しました。時間をおいて試してください'
}
