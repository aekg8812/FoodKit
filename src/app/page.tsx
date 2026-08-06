import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LandingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/home')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cream text-4xl">
            🍽️
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-ink">FoodKit</h1>
          <p className="text-sm leading-relaxed text-ink-sub">
            お店を記録して、友だちと共有。
          </p>
          <p className="text-sm leading-relaxed text-ink-sub">
            価値観の合う人の「また行きたい」が見つかる。
          </p>
        </div>

        {/* Features */}
        <ul className="mb-10 space-y-3 text-sm text-ink-sub">
          <li className="flex items-start gap-2">
            <span aria-hidden="true">📝</span>
            <span>「また行きたいか」で1〜4段階評価</span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden="true">👥</span>
            <span>グループの友だちと記録を共有</span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden="true">✨</span>
            <span>価値観が合う人のおすすめが分かる</span>
          </li>
        </ul>

        {/* CTA */}
        <div className="space-y-3">
          <Link
            href="/signup"
            className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-terra text-sm font-medium text-white transition-colors hover:bg-terra-deep"
          >
            新規登録する
          </Link>
          <Link
            href="/login"
            className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-edge text-sm font-medium text-ink transition-colors hover:bg-surface"
          >
            ログイン
          </Link>
        </div>
      </div>
    </main>
  )
}
