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
        <h1 className="text-base font-bold text-ink">パスワード再設定</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 px-5">
        <div className="mx-auto w-full max-w-sm">
          {sent ? (
            <div className="space-y-6 pt-4">
              {/* Success envelope illustration */}
              <div className="flex flex-col items-center py-8">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-terra/10">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-ink">メールを送信しました</h2>
                <p className="mt-2 text-center text-sm leading-relaxed text-ink-sub">
                  入力したメールアドレス宛に、アカウントが存在する場合は再設定メールを送信しました。メールをご確認ください。
                </p>
              </div>
              <Link
                href="/login"
                className="flex min-h-[52px] w-full items-center justify-center rounded-full border border-edge bg-canvas text-sm font-semibold text-ink transition-colors hover:bg-surface"
              >
                ログイン画面に戻る
              </Link>
            </div>
          ) : (
            <div className="pt-2 space-y-6">
              <p className="text-sm leading-relaxed text-ink-sub">
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

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-ink-sub transition-colors hover:text-ink"
                >
                  ← ログインに戻る
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
