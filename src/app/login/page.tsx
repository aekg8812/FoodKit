'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
          <h1 className="text-xl font-bold text-ink">ログイン</h1>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6">
        <div className="mx-auto w-full max-w-sm">
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
            <InputField
              id="password"
              label="パスワード"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            {error && <ErrorMessage message={error} />}

            <Button type="submit" loading={loading}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-terra transition-colors hover:text-terra-deep"
            >
              パスワードを忘れた方
            </Link>
          </div>

          <p className="mt-6 text-center text-sm text-ink-sub">
            アカウントをお持ちでない方は{' '}
            <Link href="/signup" className="font-semibold text-terra transition-colors hover:text-terra-deep">
              新規登録
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
