import { redirect } from 'next/navigation'
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
      </div>
      <BottomNav />
    </main>
  )
}
