import { redirect } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import Button from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'

export default async function SearchPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/search', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  return (
    <main className="min-h-screen bg-canvas px-6 pt-6 pb-24">
      <div className="mx-auto w-full max-w-md">
        <PageHeader title="検索" />
        <p className="mt-2 text-sm leading-relaxed text-ink-sub">
          店名・エリア・ジャンルで登録済みの店舗を検索できます。
        </p>
        <form action="/search/results" method="GET" className="mt-6 space-y-3">
          <div>
            <label htmlFor="search-q" className="block text-sm font-medium text-ink">
              キーワード
            </label>
            <input
              id="search-q"
              type="search"
              name="q"
              placeholder="例：焼肉、渋谷、居酒屋"
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-edge bg-surface px-3 py-3 text-base text-ink placeholder:text-ink-sub transition-colors duration-150 focus:border-terra focus:outline-none"
            />
          </div>
          <Button type="submit">検索する</Button>
        </form>

        <div className="mt-8 border-t border-edge pt-8">
          <h2 className="text-sm font-semibold text-ink">今日のお店を探す</h2>
          <p className="mt-1 text-sm text-ink-sub">
            人数・予算・移動時間・雰囲気などの条件でおすすめ店舗を絞り込めます。
          </p>
          <Link
            href="/search/today"
            className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-colors hover:bg-terra-deep"
          >
            今日のお店を探す
          </Link>
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
