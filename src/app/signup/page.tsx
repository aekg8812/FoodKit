'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import ErrorMessage from '@/components/ui/ErrorMessage'

export default function SignupPage() {
  const [name, setName] = useState('')
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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // When email confirmation is enabled in production, session is null until confirmed.
    if (!data.session) {
      setError('メールを確認してからログインしてください。')
      setLoading(false)
      return
    }

    // public.users and public.user_value_profiles are created by the
    // handle_new_user DB trigger — no explicit INSERT needed here.
    router.push('/home')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16">
      <div className="mb-6 text-center">
        <span className="text-3xl" aria-hidden="true">🍽️</span>
        <p className="mt-1 text-sm font-medium text-ink-sub">FoodKit</p>
      </div>

      <section className="w-full max-w-md rounded-2xl border border-edge bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-ink">新規登録</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            id="name"
            label="ユーザー名"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <InputField
            id="email"
            label="メールアドレス"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <InputField
            id="password"
            label="パスワード"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <ErrorMessage message={error} />}

          <Button type="submit" loading={loading}>
            {loading ? '登録中...' : '登録する'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-sub">
          すでにアカウントをお持ちの方は{' '}
          <Link href="/login" className="font-medium text-terra transition-colors duration-150 hover:text-terra-deep underline">
            ログイン
          </Link>
        </p>
      </section>
    </main>
  )
}
