import { redirect } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import { searchRestaurants } from '@/lib/restaurants/search'

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const params = await searchParams
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? ''

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/search/results', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  if (!q) redirect('/search')

  const restaurants = await searchRestaurants(supabase, { query: q })

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Top bar: back + search input */}
      <div className="sticky top-0 z-10 bg-canvas px-4 pb-3 pt-14">
        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className="flex h-10 w-10 shrink-0 items-center justify-center text-ink"
            aria-label="戻る"
          >
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
              <path d="M9 1 L1 9 L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <form action="/search/results" method="GET" className="flex-1">
            <div className="flex items-center gap-2 rounded-full border border-edge bg-surface px-4 py-2.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="店名・ジャンル・エリアで検索"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-sub"
                autoComplete="off"
              />
              {q && (
                <Link href="/search/results" aria-label="クリア">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-ink-sub" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.3" />
                    <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </Link>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="px-4">
        {/* Result count + sort */}
        <div className="flex items-center justify-between py-3">
          <p className="text-sm font-medium text-ink">
            「{q}」の検索結果{' '}
            <span className="text-[18px] font-black text-terra">{restaurants.length}</span>{' '}
            件
          </p>
          <button type="button" className="flex items-center gap-1 rounded-full border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-ink">
            おすすめ順
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        {restaurants.length > 0 ? (
          <ul className="space-y-3" aria-label="検索結果">
            {restaurants.map((restaurant) => (
              <li key={restaurant.id}>
                <Link
                  href={`/restaurants/${restaurant.id}`}
                  prefetch={false}
                  className="flex overflow-hidden rounded-2xl bg-surface"
                >
                  {/* Left: food photo placeholder */}
                  <div className="relative h-[130px] w-[110px] shrink-0 bg-edge">
                    <div className="flex h-full w-full items-center justify-center bg-[#F3E5D8]">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                        <line x1="6" y1="1" x2="6" y2="4" />
                        <line x1="10" y1="1" x2="10" y2="4" />
                        <line x1="14" y1="1" x2="14" y2="4" />
                      </svg>
                    </div>
                  </div>

                  {/* Right: info */}
                  <div className="flex flex-1 flex-col justify-between p-3">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-ink">{restaurant.name}</p>
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="mt-0.5 shrink-0 text-ink-sub" aria-hidden="true">
                          <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      {(restaurant.area || restaurant.genre) && (
                        <p className="mt-0.5 text-xs text-ink-sub">
                          {[restaurant.genre, restaurant.area].filter(Boolean).join('・')}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-ink-sub">
                        {restaurant.area && (
                          <span className="flex items-center gap-0.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <circle cx="12" cy="10" r="3" />
                              <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z" />
                            </svg>
                            {restaurant.area}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Evidence badge placeholder */}
                    <div className="mt-2 rounded-lg bg-[#FFF3EC] px-2.5 py-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold text-terra">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
                          <circle cx="9" cy="7" r="4" stroke="#F97316" strokeWidth="2" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        FoodKitユーザーが記録中
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          /* Empty state — PDF p26 */
          <div className="mt-6 flex flex-col items-center text-center">
            {/* Illustration */}
            <div className="mb-5">
              <svg width="120" height="100" viewBox="0 0 120 100" fill="none" aria-hidden="true">
                {/* Building background */}
                <rect x="10" y="50" width="30" height="40" rx="3" fill="#F3E5D8" />
                <rect x="20" y="40" width="40" height="50" rx="3" fill="#EDCFB8" />
                {/* Trees */}
                <circle cx="8" cy="58" r="7" fill="#F3E5D8" />
                <rect x="6" y="60" width="4" height="10" fill="#EDCFB8" />
                <circle cx="112" cy="60" r="7" fill="#F3E5D8" />
                <rect x="110" y="62" width="4" height="10" fill="#EDCFB8" />
                {/* Magnifying glass */}
                <circle cx="60" cy="46" r="28" fill="white" stroke="#E5D4C8" strokeWidth="2" />
                <circle cx="56" cy="42" r="16" fill="white" stroke="#E5D4C8" strokeWidth="3" />
                {/* Store icon inside magnifier */}
                <rect x="48" y="38" width="16" height="12" rx="2" fill="#F97316" opacity="0.9" />
                <path d="M46 38 Q56 32 66 38" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
                <rect x="53" y="42" width="6" height="8" rx="1" fill="white" />
                {/* Magnifier handle */}
                <line x1="68" y1="58" x2="80" y2="72" stroke="#E5D4C8" strokeWidth="5" strokeLinecap="round" />
                {/* Sparkle lines */}
                <line x1="80" y1="22" x2="84" y2="18" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
                <line x1="85" y1="28" x2="91" y2="26" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
                <line x1="78" y1="16" x2="78" y2="10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            <h2 className="text-xl font-black text-ink">お店が見つかりませんでした</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-sub">
              店名やジャンル、エリアを変えて、<br />
              もう一度検索してみてください。
            </p>

            {/* Register CTA card */}
            <div className="mt-6 w-full rounded-2xl border border-edge bg-surface p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terra/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-ink">FoodKitにまだ登録されていないお店ですか？</p>
                  <p className="mt-0.5 text-xs text-ink-sub">
                    まだ掲載されていない飲食店を、<br />あなたのおすすめとして登録することができます。
                  </p>
                </div>
              </div>
              <Link
                href="/restaurants/new"
                className="mt-3 flex h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-terra text-sm font-bold text-terra"
              >
                <span>+</span>
                <span>新しい飲食店を登録</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
