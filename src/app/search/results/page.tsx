import { redirect } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import { searchRestaurants } from '@/lib/restaurants/search'

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

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

  const newRestaurantHref = '/restaurants/new'

  return (
    <main className="min-h-screen bg-canvas px-6 pt-6 pb-24">
      <div className="mx-auto w-full max-w-md">
        <PageHeader title="検索結果" back={{ href: '/search' }} />

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-sm text-ink-sub">
            「<span className="font-medium text-ink">{q}</span>」
          </p>
          <p className="tabular-nums text-sm text-ink-sub">{restaurants.length}件</p>
        </div>

        {restaurants.length > 0 ? (
          <ul className="mt-4 space-y-3" aria-label="検索結果">
            {restaurants.map((restaurant) => (
              <li key={restaurant.id}>
                <Link href={`/restaurants/${restaurant.id}`} prefetch={false}>
                  <Card interactive className="p-4">
                    <p className="font-medium text-ink">{restaurant.name}</p>
                    {(restaurant.area || restaurant.genre) && (
                      <p className="mt-1 text-sm text-ink-sub">
                        {[restaurant.area, restaurant.genre].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {restaurant.address && (
                      <p className="mt-1 text-xs leading-relaxed text-ink-sub">
                        {restaurant.address}
                      </p>
                    )}
                    <p className="mt-3 text-sm font-medium text-terra">詳細を見る →</p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-8">
            <EmptyState
              icon={<SearchIcon />}
              title="店舗が見つかりませんでした"
              description="別のキーワードで検索するか、新しい店舗として登録してください。"
              action={
                <div className="w-full space-y-3">
                  <Link
                    href="/search"
                    className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-colors hover:bg-terra-deep"
                  >
                    検索し直す
                  </Link>
                  <Link
                    href={newRestaurantHref}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-edge bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-canvas"
                  >
                    新しい飲食店を登録する
                  </Link>
                </div>
              }
            />
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  )
}
