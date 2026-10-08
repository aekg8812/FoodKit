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

const USERNAME_CHECK_DELAY_MS = 400

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

  const checkSeq = useRef(0)

  const formatError = username === '' ? null : validateUsernameFormat(username)
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
          error: available
            ? null
            : 'このユーザーIDは使用できません。すでに使われているか、予約語です',
        })
      } catch {
        if (seq !== checkSeq.current) return
        setUsernameCheck({
          value: username,
          available: false,
          error: 'ユーザーIDを確認できませんでした。通信環境を確認してください',
        })
      }
    }, USERNAME_CHECK_DELAY_MS)

    return () => clearTimeout(timer)
  }, [username])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, username } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setError('メールを確認してからログインしてください。')
      setLoading(false)
      return
    }

    router.push('/onboarding/preferences')
  }

  return (
    <main className="flex min-h-screen flex-col bg-canvas">
      {/* Header */}
      <div className="flex items-center justify-center px-6 pt-16 pb-8">
        <div className="text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl shadow-md"
            style={{ background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)' }}
          >
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <path d="M8 14c0-1.1.9-2 2-2h20a2 2 0 0 1 2 2v2a12 12 0 0 1-24 0v-2Z" fill="white" fillOpacity=".9"/>
              <path d="M15 12V9a5 5 0 0 1 10 0v3" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M20 28v5M16 33h8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-ink">新規登録</h1>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pb-16">
        <div className="mx-auto w-full max-w-sm">
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
              {loading ? '登録中...' : 'アカウントを作成'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-sub">
            すでにアカウントをお持ちの方は{' '}
            <Link href="/login" className="font-semibold text-terra transition-colors hover:text-terra-deep">
              ログイン
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
