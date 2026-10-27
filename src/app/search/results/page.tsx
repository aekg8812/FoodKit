import { redirect } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import GoogleSearchSection from './GoogleSearchSection'

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; from?: string | string[] }>
}) {
  const params = await searchParams
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? ''
  const from = (Array.isArray(params.from) ? params.from[0] : params.from) ?? ''

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/search/results', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  if (!q) redirect('/search')

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Top bar: back + search input */}
      <div className="sticky top-0 z-10 bg-canvas px-4 pb-3 pt-14">
        <div className="flex items-center gap-2">
          <Link
            href={from === 'record' ? '/record' : '/search'}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-ink"
            aria-label="戻る"
          >
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
              <path
                d="M9 1 L1 9 L9 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <form action="/search/results" method="GET" className="flex flex-1 gap-2">
            {from === 'record' && <input type="hidden" name="from" value="record" />}
            <div className="flex flex-1 items-center gap-2 rounded-full border border-edge bg-surface px-4 py-2.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-ink-sub"
                aria-hidden="true"
              >
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
                <Link
                  href={from === 'record' ? '/search/results?from=record' : '/search/results'}
                  aria-label="クリア"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-ink-sub"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.3" />
                    <path
                      d="M8 8l8 8M16 8l-8 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </Link>
              )}
            </div>
            <button
              type="submit"
              className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-terra text-white"
              aria-label="検索"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      <div className="px-4">
        {/* Google Places search: FoodKitのお店 + その他のお店 */}
        <GoogleSearchSection
          query={q}
          from={from}
          foodkitPlaceIds={[]}
          serverEmpty={true}
        />
      </div>

      <BottomNav />
    </main>
  )
}
