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
    async function exchangeCode() {
      const code = searchParams.get('code')

      if (code) {
        // PKCE flow: exchange code for recovery session
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          console.error('ResetPasswordPage: code exchange failed', {
            message: exchangeError.message,
            code: exchangeError.status,
          })
          setStatus('invalid')
          return
        }
        setStatus('ready')
        return
      }

      // Hash/implicit flow: verify this is a recovery session by checking AMR.
      // A normal password-login session must NOT enable the reset form — that
      // would let logged-in users skip the current-password check in /settings/password.
      // Recovery sessions have amr method='otp'; password sessions have method='password'.
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      const isRecovery = (aal?.currentAuthenticationMethods ?? []).some(
        (m) => typeof m !== 'string' && m.method === 'otp',
      )
      if (isRecovery) {
        setStatus('ready')
      } else {
        setStatus('invalid')
      }
    }

    void exchangeCode()
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16">
      <div className="mb-6 text-center">
        <span className="text-3xl" aria-hidden="true">🍽️</span>
        <p className="mt-1 text-sm font-medium text-ink-sub">FoodKit</p>
      </div>

      <section className="w-full max-w-md rounded-2xl border border-edge bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-ink">新しいパスワードを設定</h1>
        <Suspense fallback={<p className="text-sm text-ink-sub">読み込み中...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </section>
    </main>
  )
}
