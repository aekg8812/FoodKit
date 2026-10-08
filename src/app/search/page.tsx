import { redirect } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
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
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-ink">検索</h1>
      </div>

      {/* Search bar */}
      <div className="px-5 mb-6">
        <form action="/search/results" method="GET">
          <label className="flex items-center gap-3 rounded-full border border-edge bg-surface px-4 py-3 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-terra">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              name="q"
              placeholder="店名・ジャンル・エリアで検索"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-sub"
              autoComplete="off"
            />
          </label>
        </form>
      </div>

      {/* Action cards */}
      <div className="px-5 space-y-3">
        {/* Today's restaurant — primary action */}
        <Link
          href="/search/today"
          className="flex items-center justify-between rounded-2xl border border-edge bg-surface p-5 shadow-sm transition-colors hover:bg-canvas active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-terra/10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-ink">今日のお店を探す</p>
              <p className="mt-0.5 text-xs text-ink-sub">予算・移動手段・雰囲気などで絞り込む</p>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        {/* Keyword search — secondary action */}
        <Link
          href="/search/results"
          className="flex items-center justify-between rounded-2xl border border-edge bg-surface p-5 shadow-sm transition-colors hover:bg-canvas active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink/5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-sub" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-ink">キーワードで探す</p>
              <p className="mt-0.5 text-xs text-ink-sub">店名・ジャンル・エリアから検索</p>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>
      </div>

      <BottomNav />
    </main>
  )
}
