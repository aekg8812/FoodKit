'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import ErrorMessage from '@/components/ui/ErrorMessage'
import {
  USERNAME_MAX,
  checkUsernameAvailable,
  validateUsernameFormat,
} from '@/lib/users/username'

// 入力が止まってから空き確認を投げるまでの待ち時間（設計書 E1 §5）
const USERNAME_CHECK_DELAY_MS = 400

// 空き確認の結果。どの入力値に対する結果かを保持し、
// 入力が変わったら自動的に無効になるようにする。
type UsernameCheck = {
  value: string
  available: boolean
  error: string | null
}

export default function SignupPage() {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // 空き確認のリクエスト世代。応答が入れ替わって届いたとき、
  // 古い応答が新しい入力の結果を上書きしないように捨てる。
  const checkSeq = useRef(0)

  // 形式チェックは通信不要なのでレンダー中に導出する（stateにしない）
  const formatError = username === '' ? null : validateUsernameFormat(username)

  // 入力値と一致する結果だけを有効とみなす
  const currentCheck = usernameCheck?.value === username ? usernameCheck : null
  const usernameAvailable = currentCheck?.available ?? false
  const usernameError = formatError ?? currentCheck?.error ?? null
  const usernameChecking = username !== '' && formatError === null && currentCheck === null

  useEffect(() => {
    if (username === '') return
    if (validateUsernameFormat(username) !== null) return

    const seq = ++checkSeq.current
    const timer = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(username)
        if (seq !== checkSeq.current) return
        setUsernameCheck({
          value: username,
          available,
          // is_username_available は重複と予約語を区別せず false を返すため、
          // どちらでも成り立つ文言にする（予約語リストはDBが唯一の正）
          error: available
            ? null
            : 'このユーザーIDは使用できません。すでに使われているか、予約語です',
        })
      } catch {
        if (seq !== checkSeq.current) return
        // 生エラーは checkUsernameAvailable 内で console.error 済み
        setUsernameCheck({
          value: username,
          available: false,
          error: 'ユーザーIDを確認できませんでした。通信環境を確認してください',
        })
      }
    }, USERNAME_CHECK_DELAY_MS)

    // 入力が続いている間は前回のタイマーを破棄する
    return () => clearTimeout(timer)
  }, [username])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // username は handle_new_user トリガーが raw_user_meta_data から読む
      options: { data: { name, username } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // When email confirmation is enabled in production, session is null until confirmed.
    if (!data.session) {
      setError('メールを確認してからログインしてください。')
      setLoading(false)
      return
    }

    // public.users and public.user_value_profiles are created by the
    // handle_new_user DB trigger — no explicit INSERT needed here.
    router.push('/home')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16">
      <div className="mb-6 text-center">
        <span className="text-3xl" aria-hidden="true">🍽️</span>
        <p className="mt-1 text-sm font-medium text-ink-sub">FoodKit</p>
      </div>

      <section className="w-full max-w-md rounded-2xl border border-edge bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-ink">新規登録</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            id="name"
            label="ユーザー名"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div>
            <InputField
              id="username"
              label="ユーザーID"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              error={usernameError ?? undefined}
              maxLength={USERNAME_MAX}
              placeholder="ayabe"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
            {!usernameError && (
              <p
                className={`mt-1 text-xs ${usernameAvailable ? 'text-green-700' : 'text-ink-sub'}`}
                aria-live="polite"
              >
                {usernameChecking
                  ? '確認中...'
                  : usernameAvailable
                    ? 'このユーザーIDは使えます'
                    : '半角英数字と _ . - が使えます。後から変更できます'}
              </p>
            )}
          </div>

          <InputField
            id="email"
            label="メールアドレス"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <InputField
            id="password"
            label="パスワード"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <ErrorMessage message={error} />}

          <Button type="submit" loading={loading} disabled={!usernameAvailable}>
            {loading ? '登録中...' : '登録する'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-sub">
          すでにアカウントをお持ちの方は{' '}
          <Link href="/login" className="font-medium text-terra transition-colors duration-150 hover:text-terra-deep underline">
            ログイン
          </Link>
        </p>
      </section>
    </main>
  )
}
