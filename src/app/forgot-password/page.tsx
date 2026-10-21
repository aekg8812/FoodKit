'use client'

import Link from 'next/link'
import { useState } from 'react'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/client'

function FoodKitLogoStacked() {
  return (
    <div className="flex flex-col items-center gap-0.5">
      {/* Fork + Spoon icons */}
      <svg width="42" height="34" viewBox="0 0 56 44" fill="none" aria-label="FoodKit" role="img">
        {/* Fork */}
        <g transform="translate(4, 2) rotate(-10, 10, 22)">
          <line x1="10" y1="0" x2="10" y2="38" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
          <line x1="6" y1="0" x2="6" y2="13" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="14" y1="0" x2="14" y2="13" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M6 13 Q6 17 10 17 Q14 17 14 13" stroke="#F97316" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
        {/* Spoon */}
        <g transform="translate(32, 2) rotate(10, 10, 22)">
          <ellipse cx="10" cy="8" rx="7" ry="9" fill="#F97316" />
          <line x1="10" y1="17" x2="10" y2="40" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
      {/* Wordmark */}
      <span className="text-[22px] font-black leading-none tracking-tight text-ink" style={{ fontFamily: 'system-ui, sans-serif' }}>
        FoodKit
      </span>
    </div>
  )
}

function FoodIllustrations() {
  return (
    <div className="pointer-events-none relative w-full overflow-hidden" style={{ height: '140px' }}>
      {/* Wavy peach background */}
      <svg
        viewBox="0 0 375 140"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <path
          d="M0,55 C60,25 120,40 187,32 C254,24 310,44 375,36 L375,140 L0,140 Z"
          fill="#FFE8D6"
          opacity="0.7"
        />
      </svg>
      {/* Decorative dots */}
      <span className="absolute left-[15%] top-[22px] h-1 w-1 rounded-full bg-terra/20" aria-hidden="true" />
      <span className="absolute left-[55%] top-[14px] h-1 w-1 rounded-full bg-terra/20" aria-hidden="true" />
      <span className="absolute right-[15%] top-[26px] h-1 w-1 rounded-full bg-terra/20" aria-hidden="true" />
      {/* Food illustrations */}
      <svg
        viewBox="0 0 375 140"
        className="absolute inset-0 h-full w-full"
        fill="none"
        aria-hidden="true"
      >
        {/* Bowl / ramen */}
        <g transform="translate(42, 60)" stroke="#F9A17C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
          <ellipse cx="28" cy="8" rx="28" ry="8" />
          <path d="M4 8 Q0 28 28 32 Q56 28 52 8" />
          <path d="M12 0 Q14 -8 16 0" />
          <path d="M28 0 Q30 -8 32 0" />
        </g>
        {/* Pizza slice */}
        <g transform="translate(167, 54)" stroke="#F9A17C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
          <path d="M20 0 L0 40 L40 40 Z" />
          <path d="M0 40 Q20 44 40 40" />
          <circle cx="20" cy="28" r="3" />
          <circle cx="12" cy="18" r="2" />
          <circle cx="28" cy="20" r="2" />
        </g>
        {/* Burger */}
        <g transform="translate(296, 58)" stroke="#F9A17C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
          <path d="M4 10 Q20 0 36 10" />
          <rect x="2" y="10" width="36" height="7" rx="2" />
          <rect x="0" y="17" width="40" height="6" rx="1" />
          <rect x="2" y="23" width="36" height="7" rx="2" />
          <path d="M4 30 Q20 40 36 30" />
        </g>
      </svg>
    </div>
  )
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const redirectTo = `${window.location.origin}/reset-password`

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (resetError) {
      console.error('ForgotPasswordPage: resetPasswordForEmail failed', {
        message: resetError.message,
        code: resetError.status,
      })
      setError('送信できませんでした。時間をおいて再度お試しください。')
      setLoading(false)
      return
    }

    setLoading(false)
    setSent(true)
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-canvas">
      {/* Back button */}
      <div className="px-5 pt-6">
        <Link href="/login" className="inline-flex h-10 w-10 items-center justify-center text-ink" aria-label="ログインに戻る">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
            <path d="M9 1 L1 9 L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* Logo */}
      <div className="pt-1 pb-3 text-center">
        <FoodKitLogoStacked />
      </div>

      {/* Content */}
      <div className="flex-1 px-6">
        <div className="mx-auto w-full max-w-sm">
          {sent ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center text-center">
              {/* Envelope with checkmark illustration */}
              <div className="relative mb-5">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-terra/10">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-terra">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </div>

              <h1 className="text-xl font-bold text-ink">メールを送信しました</h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-sub">
                入力されたメールアドレス宛に、アカウントが存在する場合はパスワード再設定用のメールを送信しました。
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-sub">
                メール内のリンクから<br />新しいパスワードを設定してください。
              </p>

              <Link
                href="/login"
                className="mt-6 flex h-[48px] w-full items-center justify-center rounded-xl bg-terra text-sm font-bold text-white"
              >
                ログイン画面に戻る
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <div>
              <h1 className="mb-2 text-center text-xl font-black text-ink">パスワードを再設定</h1>
              <p className="mb-4 text-center text-xs leading-relaxed text-ink-sub">
                FoodKitに登録しているメールアドレスを<br />
                入力してください。<br />
                パスワード再設定用のメールをお送りします。
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
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
                      className="w-full rounded-xl border border-edge bg-surface py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-sub/60 focus:border-terra focus:outline-none"
                    />
                  </div>
                </div>

                {error && <ErrorMessage message={error} />}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 flex h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-terra text-sm font-bold text-white disabled:opacity-50"
                >
                  {loading && (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                      <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg>
                  )}
                  {loading ? '送信中...' : '再設定メールを送信'}
                </button>
              </form>

              <div className="mt-3 text-center">
                <Link href="/login" className="text-xs font-medium text-terra">
                  ログイン画面に戻る
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom food illustrations */}
      <div className="mt-auto">
        <FoodIllustrations />
      </div>
    </main>
  )
}
