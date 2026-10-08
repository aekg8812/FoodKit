'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/client'

const PASSWORD_MIN = 6

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
  const canSubmit =
    newPassword.length >= PASSWORD_MIN && confirmPassword !== '' && newPassword === confirmPassword

  useEffect(() => {
    // `recovered` guards against late state mutations after unmount or
    // duplicate events. All closures share the same variable.
    let recovered = false

    // PASSWORD_RECOVERY is the sole event that enables the reset form.
    // INITIAL_SESSION / SIGNED_IN / TOKEN_REFRESHED from normal sessions do NOT.
    //
    // Hash/implicit flow: _initialize() reads #type=recovery from the URL,
    //   fires PASSWORD_RECOVERY on the next tick via setTimeout(..., 0).
    // PKCE flow: exchangeCodeForSession() reads the stored code-verifier which
    //   carries a "/recovery" suffix set by resetPasswordForEmail(), and fires
    //   PASSWORD_RECOVERY (not SIGNED_IN) when that suffix is present.
    // OTP normal login: fires SIGNED_IN (params.type !== 'recovery') — blocked.
    // Password normal login: fires SIGNED_IN — blocked.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        recovered = true
        setStatus('ready')
      }
    })

    // PKCE: exchange ?code= so the SDK can determine redirectType from storage.
    // On success PASSWORD_RECOVERY fires via the subscriber above; we do not
    // set status here. On failure the code is invalid/expired → invalid state.
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

    // Fallback timeout: if PASSWORD_RECOVERY never fires (direct access by a
    // normal user, expired link, missing hash/code), show invalid after 2s.
    const timer = setTimeout(() => {
      if (!recovered) {
        setStatus('invalid')
      }
    }, 2000)

    return () => {
      recovered = true // prevent late state mutation after unmount
      subscription.unsubscribe()
      clearTimeout(timer)
    }
    // searchParams is stable; supabase client is stable — safe to omit.
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
      <p className="text-sm text-ink-sub">読み込み中...</p>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-sub">
          再設定リンクが無効または期限切れです。
        </p>
        <Link
          href="/forgot-password"
          className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-terra text-sm font-medium text-white transition-colors hover:bg-terra-deep"
        >
          再設定メールをもう一度送る
        </Link>
        <Link
          href="/login"
          className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-edge text-sm font-medium text-ink transition-colors hover:bg-canvas"
        >
          ログインに戻る
        </Link>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-green-700">
          パスワードを変更しました。
        </p>
        <Link
          href="/login"
          className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-terra text-sm font-medium text-white transition-colors hover:bg-terra-deep"
        >
          ログイン画面へ
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <InputField
        id="new-password"
        label="新しいパスワード"
        type="password"
        required
        minLength={PASSWORD_MIN}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        error={tooShort ? `${PASSWORD_MIN}文字以上で入力してください` : undefined}
        autoComplete="new-password"
      />

      <InputField
        id="confirm-password"
        label="新しいパスワード（確認）"
        type="password"
        required
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={mismatch ? 'パスワードが一致しません' : undefined}
        autoComplete="new-password"
      />

      {error && <ErrorMessage message={error} />}

      <Button type="submit" loading={submitting} disabled={!canSubmit}>
        {submitting ? '設定中...' : 'パスワードを設定'}
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col bg-canvas">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-6">
        <Link
          href="/login"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-sub transition-colors hover:bg-surface"
          aria-label="ログインに戻る"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-base font-bold text-ink">新しいパスワードを設定</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 px-5">
        <div className="mx-auto w-full max-w-sm">
          <p className="mb-6 text-sm leading-relaxed text-ink-sub">
            現在のパスワードを入力して、新しいパスワードに変更します
          </p>
          <Suspense fallback={<p className="text-sm text-ink-sub">読み込み中...</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
