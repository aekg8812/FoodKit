'use client'

import Link from 'next/link'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/client'

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16">
      <div className="mb-6 text-center">
        <span className="text-3xl" aria-hidden="true">🍽️</span>
        <p className="mt-1 text-sm font-medium text-ink-sub">FoodKit</p>
      </div>

      <section className="w-full max-w-md rounded-2xl border border-edge bg-surface p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-ink">パスワード再設定</h1>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-sub">
              入力したメールアドレス宛に、アカウントが存在する場合は再設定メールを送信しました。メールをご確認ください。
            </p>
            <Link
              href="/login"
              className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-edge text-sm font-medium text-ink transition-colors hover:bg-canvas"
            >
              ログインに戻る
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm leading-relaxed text-ink-sub">
              登録したメールアドレスを入力してください。パスワード再設定のリンクをお送りします。
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <InputField
                id="email"
                label="メールアドレス"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />

              {error && <ErrorMessage message={error} />}

              <Button type="submit" loading={loading}>
                {loading ? '送信中...' : '再設定メールを送信'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="text-sm text-ink-sub transition-colors hover:text-ink"
              >
                ← ログインに戻る
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
