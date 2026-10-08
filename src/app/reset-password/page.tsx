'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/client'

const PASSWORD_MIN = 8

function FoodKitLogoStacked() {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="56" height="44" viewBox="0 0 56 44" fill="none" aria-label="FoodKit" role="img">
        <g transform="translate(4, 2) rotate(-10, 10, 22)">
          <line x1="10" y1="0" x2="10" y2="38" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
          <line x1="6" y1="0" x2="6" y2="13" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="14" y1="0" x2="14" y2="13" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M6 13 Q6 17 10 17 Q14 17 14 13" stroke="#F97316" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
        <g transform="translate(32, 2) rotate(10, 10, 22)">
          <ellipse cx="10" cy="8" rx="7" ry="9" fill="#F97316" />
          <line x1="10" y1="17" x2="10" y2="40" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
      <span className="text-[28px] font-black leading-none tracking-tight text-ink" style={{ fontFamily: 'system-ui, sans-serif' }}>
        FoodKit
      </span>
    </div>
  )
}

function FoodIllustrations() {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: '180px' }}>
      <svg viewBox="0 0 375 180" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M0,70 C60,30 120,50 187,40 C254,30 310,55 375,45 L375,180 L0,180 Z" fill="#FFE8D6" />
      </svg>
      <span className="absolute left-[15%] top-[30px] h-1.5 w-1.5 rounded-full bg-terra/30" aria-hidden="true" />
      <span className="absolute left-[55%] top-[20px] h-1.5 w-1.5 rounded-full bg-terra/30" aria-hidden="true" />
      <span className="absolute right-[15%] top-[35px] h-1.5 w-1.5 rounded-full bg-terra/30" aria-hidden="true" />
      <svg viewBox="0 0 375 180" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
        <g transform="translate(42, 75)" stroke="#F9A17C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="28" cy="8" rx="28" ry="8" />
          <path d="M4 8 Q0 28 28 32 Q56 28 52 8" />
          <path d="M12 0 Q14 -8 16 0" />
          <path d="M28 0 Q30 -8 32 0" />
        </g>
        <g transform="translate(167, 68)" stroke="#F9A17C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 0 L0 40 L40 40 Z" />
          <path d="M0 40 Q20 44 40 40" />
          <circle cx="20" cy="28" r="3" />
          <circle cx="12" cy="18" r="2" />
          <circle cx="28" cy="20" r="2" />
        </g>
        <g transform="translate(296, 72)" stroke="#F9A17C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

function PasswordField({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  error?: string | null
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-ink">{label}</label>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-sub">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 11 V7 a4 4 0 0 1 8 0 V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          minLength={PASSWORD_MIN}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`w-full rounded-xl border bg-surface py-3 pl-9 pr-10 text-base text-ink placeholder:text-ink-sub/60 focus:outline-none ${error ? 'border-red-400' : 'border-edge focus:border-terra'}`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-sub"
          aria-label={show ? 'パスワードを隠す' : 'パスワードを表示'}
        >
          {show ? (
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
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-sub">{hint}</p>
      ) : null}
    </div>
  )
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid' | 'success'>('loading')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const tooShort = newPassword !== '' && newPassword.length < PASSWORD_MIN
  const mismatch = confirmPassword !== '' && newPassword !== confirmPassword
  const passwordsMatch = confirmPassword !== '' && newPassword === confirmPassword && !tooShort
  const canSubmit = newPassword.length >= PASSWORD_MIN && confirmPassword !== '' && newPassword === confirmPassword

  useEffect(() => {
    let recovered = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        recovered = true
        setStatus('ready')
      }
    })

    const code = searchParams.get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (exchangeError) {
          console.error('ResetPasswordPage: code exchange failed', {
            message: exchangeError.message,
            code: exchangeError.status,
          })
          if (!recovered) {
            setStatus('invalid')
          }
        }
      })
    }

    const timer = setTimeout(() => {
      if (!recovered) {
        setStatus('invalid')
      }
    }, 2000)

    return () => {
      recovered = true
      subscription.unsubscribe()
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

    if (updateError) {
      console.error('ResetPasswordPage: updateUser failed', {
        message: updateError.message,
        code: updateError.status,
      })
      setError('パスワードを設定できませんでした。もう一度お試しください。')
      setSubmitting(false)
      return
    }

    setStatus('success')
    setSubmitting(false)
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-terra/10">
          <svg className="h-8 w-8 animate-spin text-terra" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
        </div>
        <p className="mt-4 text-sm text-ink-sub">確認中...</p>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-sub">
          再設定リンクが無効または期限切れです。もう一度お試しください。
        </p>
        <Link
          href="/forgot-password"
          className="flex h-[52px] w-full items-center justify-center rounded-xl bg-terra text-base font-bold text-white"
        >
          再設定メールをもう一度送る
        </Link>
        <div className="text-center">
          <Link href="/login" className="text-sm font-medium text-terra">
            ログイン画面に戻る
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center text-center">
        {/* Success circle */}
        <div className="relative mb-5">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-terra/10">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-terra">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          </div>
        </div>

        <h2 className="text-xl font-bold text-ink">パスワードを変更しました</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-sub">
          新しいパスワードで<br />FoodKitにログインできます。
        </p>

        <Link
          href="/login"
          className="mt-8 flex h-[52px] w-full items-center justify-center rounded-xl bg-terra text-base font-bold text-white"
        >
          ログイン画面へ
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PasswordField
        id="new-password"
        label="新しいパスワード"
        value={newPassword}
        onChange={setNewPassword}
        hint="※ 8文字以上の半角英数字で設定してください"
        error={tooShort ? `${PASSWORD_MIN}文字以上で入力してください` : null}
        autoComplete="new-password"
      />

      <PasswordField
        id="confirm-password"
        label="新しいパスワードをもう一度入力"
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={mismatch ? 'パスワードが一致しません' : null}
        autoComplete="new-password"
      />

      {/* Match indicator */}
      {passwordsMatch && (
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="text-sm font-medium text-emerald-600">パスワードが一致しています</span>
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-terra text-base font-bold text-white disabled:opacity-50"
      >
        {submitting && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
            <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
        )}
        {submitting ? '設定中...' : '新しいパスワードを設定'}
      </button>

      <div className="text-center">
        <Link href="/login" className="text-sm font-medium text-terra">
          ログイン画面に戻る
        </Link>
      </div>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-canvas">
      {/* Back button */}
      <div className="px-5 pt-14">
        <Link href="/login" className="inline-flex h-10 w-10 items-center justify-center text-ink" aria-label="ログインに戻る">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
            <path d="M9 1 L1 9 L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* Logo */}
      <div className="pt-3 pb-6 text-center">
        <FoodKitLogoStacked />
      </div>

      {/* Content */}
      <div className="flex-1 px-6">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="mb-2 text-center text-2xl font-black text-ink">新しいパスワードを設定</h1>
          <p className="mb-6 text-center text-sm leading-relaxed text-ink-sub">
            これからログインに使用する<br />
            新しいパスワードを入力してください。
          </p>

          <Suspense
            fallback={
              <div className="flex flex-col items-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-terra/10">
                  <svg className="h-8 w-8 animate-spin text-terra" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                </div>
                <p className="mt-4 text-sm text-ink-sub">新しいパスワードを設定しています。しばらくお待ちください。</p>
                <p className="mt-2 text-sm font-medium text-ink-sub">設定中...</p>
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>

      {/* Bottom food illustrations */}
      <div className="mt-auto">
        <FoodIllustrations />
      </div>
    </main>
  )
}
