'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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

function FoodKitLogo() {
  return (
    <div className="relative inline-flex items-center justify-center">
      <span
        className="select-none text-[40px] font-black leading-none tracking-tight text-ink"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        F
      </span>
      <span className="relative mx-0.5 inline-flex h-[34px] w-[34px] items-center justify-center">
        <svg viewBox="0 0 42 42" fill="none" className="h-full w-full" aria-hidden="true">
          <circle cx="21" cy="21" r="21" fill="#F97316" />
          <line x1="21" y1="10" x2="21" y2="36" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
          <path
            d="M15 10 L15 20 Q15 25 21 25 Q27 25 27 20 L27 10"
            stroke="white"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </span>
      <span
        className="select-none text-[40px] font-black leading-none tracking-tight text-ink"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        od
      </span>
      <span
        className="select-none text-[40px] font-black leading-none tracking-tight text-terra"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        Kit
      </span>
      <span className="absolute -right-3 -top-2" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 0 L9.2 5.8 L15 8 L9.2 10.2 L8 16 L6.8 10.2 L1 8 L6.8 5.8 Z" fill="#F97316" />
        </svg>
      </span>
    </div>
  )
}

export default function SignupPage() {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-canvas">
      {/* Blob clip-path for bottom food image */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <clipPath id="signup-wave" clipPathUnits="objectBoundingBox">
            <path d="M0,0.35 C0.15,0.08 0.35,0.18 0.5,0.10 C0.65,0.02 0.85,0.12 1,0.28 L1,1 L0,1 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Peach blob decoration */}
      <div
        className="pointer-events-none absolute -left-10 top-28 h-[100px] w-[100px] rounded-[60%_40%_55%_45%/50%_60%_40%_50%] opacity-50"
        style={{ background: '#FFD9B4' }}
        aria-hidden="true"
      />

      {/* Back button */}
      <div className="px-5 pt-14">
        <Link href="/" className="inline-flex h-10 w-10 items-center justify-center text-ink">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-label="戻る">
            <path d="M9 1 L1 9 L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* Logo + heading */}
      <div className="pt-2 pb-4 text-center">
        <div className="flex justify-center">
          <FoodKitLogo />
        </div>
        <h1 className="mt-3 text-base font-bold text-ink">FoodKitへようこそ</h1>
        <p className="mt-1 text-sm leading-snug text-ink-sub">
          友達や価値観の近い人の「また行きたい」から
          <br />
          次のお店を見つけよう。
        </p>
      </div>

      {/* Tab switcher: ログイン / 新規登録 */}
      <div className="mx-auto w-full max-w-sm px-6 pb-5">
        <div className="flex rounded-full bg-edge/40 p-1">
          <Link
            href="/login"
            className="flex-1 rounded-full py-2 text-center text-sm font-medium text-ink-sub"
          >
            ログイン
          </Link>
          <span className="flex-1 rounded-full bg-terra py-2 text-center text-sm font-bold text-white">
            新規登録
          </span>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pb-6">
        <div className="mx-auto w-full max-w-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ユーザー名 */}
            <div>
              <label htmlFor="name" className="block text-sm font-bold text-ink">
                ユーザー名
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-sub">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="name"
                  type="text"
                  required
                  placeholder="例：山田 太郎"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-edge bg-surface py-3 pl-9 pr-3 text-base text-ink placeholder:text-ink-sub/60 focus:border-terra focus:outline-none"
                />
              </div>
            </div>

            {/* ユーザーID */}
            <div>
              <label htmlFor="username" className="block text-sm font-bold text-ink">
                ユーザーID
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-sub">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                    <path d="M16 12c0 2.2 1 4 2 4s2-1 2-4a8 8 0 1 0-3 6.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="username"
                  type="text"
                  required
                  placeholder="例：kawata"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.trim())}
                  maxLength={USERNAME_MAX}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={`w-full rounded-xl border bg-surface py-3 pl-9 pr-3 text-base text-ink placeholder:text-ink-sub/60 focus:outline-none ${usernameError ? 'border-red-400 focus:border-red-400' : 'border-edge focus:border-terra'}`}
                />
              </div>
              {usernameError ? (
                <p className="mt-1 text-xs text-red-600">{usernameError}</p>
              ) : usernameChecking ? (
                <p className="mt-1 text-xs text-ink-sub">確認中...</p>
              ) : usernameAvailable ? (
                <p className="mt-1 text-xs text-green-700">このユーザーIDは使えます</p>
              ) : (
                <p className="mt-1 text-xs text-ink-sub">※ 他のユーザーに表示されるIDです</p>
              )}
            </div>

            {/* メールアドレス */}
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-ink">
                メールアドレス
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-sub">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M2 8 L12 14 L22 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="example@foodkit.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-edge bg-surface py-3 pl-9 pr-3 text-base text-ink placeholder:text-ink-sub/60 focus:border-terra focus:outline-none"
                />
              </div>
            </div>

            {/* パスワード */}
            <div>
              <label htmlFor="password" className="block text-sm font-bold text-ink">
                パスワード
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-sub">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 11 V7 a4 4 0 0 1 8 0 V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  placeholder="パスワードを入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-edge bg-surface py-3 pl-9 pr-10 text-base text-ink placeholder:text-ink-sub/60 focus:border-terra focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-sub"
                  aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="2" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M17.9 17.9A9.9 9.9 0 0 1 12 19c-6.4 0-10-7-10-7a17.7 17.7 0 0 1 4.1-5.1M9.9 4.2A9.4 9.4 0 0 1 12 4c6.4 0 10 7 10 7a17.8 17.8 0 0 1-2.2 3.1M2 2 L22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-ink-sub">※ 8文字以上の半角英数字で設定してください</p>
            </div>

            {error && <ErrorMessage message={error} />}

            <button
              type="submit"
              disabled={loading || !usernameAvailable}
              className="mt-2 flex h-[52px] w-full items-center justify-center rounded-full bg-terra text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '登録中...' : 'アカウントを作成　›'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-ink-sub">
            すでにアカウントをお持ちの方は{' '}
            <Link href="/login" className="font-bold text-terra">
              ログイン ›
            </Link>
          </p>
        </div>
      </div>

      {/* Bottom food image with wavy top mask */}
      <div className="mt-auto w-full" style={{ height: '200px' }}>
        <div className="relative h-full w-full overflow-hidden">
          {/* Orange accent dashes */}
          <span
            className="pointer-events-none absolute right-[20px] top-[16px] z-10 h-[3px] w-[18px] rounded-full bg-terra"
            style={{ transform: 'rotate(-30deg)' }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute right-[8px] top-[40px] z-10 h-[3px] w-[14px] rounded-full bg-terra"
            style={{ transform: 'rotate(20deg)' }}
            aria-hidden="true"
          />
          <div className="h-full w-full" style={{ clipPath: 'url(#signup-wave)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/signup-food.png"
              alt=""
              className="h-full w-full object-cover object-top"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </main>
  )
}
