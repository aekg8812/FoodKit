'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ErrorMessage from '@/components/ui/ErrorMessage'

function toJapaneseAuthError(message: string): string {
  if (message.includes('Invalid login credentials') || message.includes('invalid_credentials')) {
    return 'メールアドレスまたはパスワードが正しくありません。'
  }
  if (message.includes('Email not confirmed')) {
    return 'メールアドレスの確認が完了していません。受信メールをご確認ください。'
  }
  if (message.includes('Too many requests')) {
    return '試行回数が多すぎます。しばらく待ってから再度お試しください。'
  }
  return 'ログインできませんでした。時間をおいて再度お試しください。'
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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      console.error('LoginPage: sign in failed', {
        message: signInError.message,
        code: signInError.status,
      })
      setError(toJapaneseAuthError(signInError.message))
      setLoading(false)
      return
    }

    router.push('/home')
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-canvas">
      {/* Hidden SVG clip-path for bottom food wave */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <clipPath id="login-wave" clipPathUnits="objectBoundingBox">
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

      {/* Tab switcher: ログイン (active) / 新規登録 */}
      <div className="mx-auto w-full max-w-sm px-6 pb-5">
        <div className="flex rounded-full bg-edge/40 p-1">
          <span className="flex-1 rounded-full bg-terra py-2 text-center text-sm font-bold text-white">
            ログイン
          </span>
          <Link
            href="/signup"
            className="flex-1 rounded-full py-2 text-center text-sm font-medium text-ink-sub"
          >
            新規登録
          </Link>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6">
        <div className="mx-auto w-full max-w-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  autoComplete="email"
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
                  placeholder="パスワードを入力"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
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
            </div>

            {/* パスワードを忘れた方 */}
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-terra"
              >
                パスワードを忘れた方 ›
              </Link>
            </div>

            {error && <ErrorMessage message={error} />}

            <button
              type="submit"
              disabled={loading}
              className="flex h-[52px] w-full items-center justify-center rounded-full bg-terra text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'ログイン中...' : 'ログイン　›'}
            </button>
          </form>
        </div>
      </div>

      {/* Bottom food image with wavy top */}
      <div className="mt-auto w-full" style={{ height: '220px' }}>
        <div className="relative h-full w-full overflow-hidden">
          {/* Orange accent dashes */}
          <span
            className="pointer-events-none absolute right-[20px] top-[20px] z-10 h-[3px] w-[18px] rounded-full bg-terra"
            style={{ transform: 'rotate(-30deg)' }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute right-[8px] top-[48px] z-10 h-[3px] w-[14px] rounded-full bg-terra"
            style={{ transform: 'rotate(20deg)' }}
            aria-hidden="true"
          />
          <div className="h-full w-full" style={{ clipPath: 'url(#login-wave)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero-food.png"
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
