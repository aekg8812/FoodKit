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
      {/* Header */}
      <div className="px-4 pt-14 pb-2 text-center">
        <h1 className="text-xl font-black text-ink">検索</h1>
      </div>

      {/* Search bar */}
      <div className="px-4 pb-4">
        <form action="/search/results" method="GET">
          <label className="flex items-center gap-2 rounded-full border border-edge bg-surface px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
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
        <p className="mt-2 text-center text-xs text-ink-sub">
          行きたいお店を直接探すか、今日の条件から探せます
        </p>
      </div>

      <div className="px-4 space-y-5">
        {/* 今日のお店を探す — hero card */}
        <div className="overflow-hidden rounded-2xl bg-surface">
          <div className="relative flex min-h-[180px]">
            {/* Left content */}
            <div className="flex flex-1 flex-col justify-between p-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-terra" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15 18l6-6-6-6" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
                  </svg>
                  <h2 className="text-lg font-black text-ink">今日のお店を探す</h2>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-sub">
                  予算・人数・移動時間・雰囲気などから、<br />
                  今の条件に合うお店をおすすめします
                </p>
              </div>

              {/* Example chips */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['友達と', '¥2,000以下', '近くで', 'ゆっくり'].map((label) => (
                  <span key={label} className="rounded-full border border-edge bg-canvas px-2.5 py-1 text-xs font-medium text-ink-sub">
                    {label}
                  </span>
                ))}
              </div>

              <Link
                href="/search/today"
                className="mt-3 flex h-[44px] items-center justify-center gap-1 rounded-xl bg-terra text-sm font-bold text-white"
              >
                条件を設定する
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            </div>

            {/* Right: food photo */}
            <div className="relative w-[130px] shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/hero-food.png"
                alt=""
                className="h-full w-full object-cover object-center"
                aria-hidden="true"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-surface/20" />
              <div className="absolute right-2 top-3">
                <p className="text-right text-[10px] font-bold leading-snug text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                  今日は<br />どんなお店に行く？
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 探し方 */}
        <div>
          <h2 className="mb-2 font-black text-ink">探し方</h2>
          <div className="divide-y divide-edge overflow-hidden rounded-2xl bg-surface">
            <Link
              href="/search/results"
              className="flex min-h-[60px] items-center gap-3 px-4 py-3 hover:bg-canvas"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terra/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold text-ink">キーワードで探す</p>
                <p className="text-xs text-ink-sub">店名・ジャンル・エリアから探す</p>
              </div>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/search/today"
              className="flex min-h-[60px] items-center gap-3 px-4 py-3 hover:bg-canvas"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terra/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-bold text-ink">FoodKitに選んでもらう</p>
                <p className="text-xs text-ink-sub">今日の条件からおすすめを探す</p>
              </div>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
