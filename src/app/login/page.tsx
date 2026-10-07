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
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16">
      <div className="mb-6 text-center">
        <span className="text-3xl" aria-hidden="true">🍽️</span>
        <p className="mt-1 text-sm font-medium text-ink-sub">FoodKit</p>
      </div>

      <section className="w-full max-w-md rounded-2xl border border-edge bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-ink">ログイン</h1>

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

        <div className="mt-4 text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-terra transition-colors hover:text-terra-deep"
          >
            パスワードを忘れた方
          </Link>
        </div>

        <p className="mt-4 text-center text-sm text-ink-sub">
          アカウントをお持ちでない方は{' '}
          <Link href="/signup" className="font-medium text-terra transition-colors duration-150 hover:text-terra-deep underline">
            新規登録
          </Link>
        </p>
      </section>
    </main>
  )
}
