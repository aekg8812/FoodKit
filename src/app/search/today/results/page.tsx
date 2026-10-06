import { redirect } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import {
  parseTodaySearchParams,
  serializeTodaySearchParams,
  getActiveConditionLabels,
  FOOD_TO_GENRE,
} from '@/lib/restaurants/todaySearch'
import ErrorMessage from '@/components/ui/ErrorMessage'

type TodayRestaurantRow = {
  restaurant_id: string
  name: string
  area: string | null
  genre: string | null
  address: string | null
  budget_per_person_max_yen: number | null
  walk_in_available: boolean | null
  parking_available: boolean | null
  same_type_review_count: number
  overall_review_count: number
  ranking_score: number
  ranking_source: string
}

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

type SearchTodayResultsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SearchTodayResultsPage({ searchParams }: SearchTodayResultsPageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/search/today/results', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const raw = await searchParams
  const parsed = parseTodaySearchParams(raw)

  const conditionLabels = getActiveConditionLabels(parsed)
  const conditionQs = serializeTodaySearchParams(parsed).toString()
  const changeHref = `/search/today${conditionQs ? `?${conditionQs}&from=results` : '?from=results'}`

  const { data, error } = await supabase.rpc('get_today_restaurants', {
    p_party_tag: parsed.party ?? null,
    p_budget_max: parsed.budget ?? null,
    p_genre: parsed.food ? FOOD_TO_GENRE[parsed.food] : null,
    p_atmosphere_tag: parsed.vibe ?? null,
    p_walk_in: parsed.walkIn,
    p_parking: parsed.parking,
    p_limit: 20,
    p_open_now: parsed.openNow,
  })

  if (error) {
    console.error('SearchTodayResultsPage: get_today_restaurants failed', error)
    return (
      <main className="min-h-screen bg-canvas px-6 pt-6 pb-24">
        <div className="mx-auto w-full max-w-md">
          <PageHeader title="おすすめのお店" back={{ href: changeHref }} />
          <div className="mt-8 space-y-4">
            <ErrorMessage message="おすすめ店舗の取得に失敗しました。時間をおいてもう一度お試しください。" />
            <Link
              href={changeHref}
              className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-edge bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-canvas"
            >
              条件を変更する
            </Link>
          </div>
        </div>
        <BottomNav />
      </main>
    )
  }

  const restaurants = (data ?? []) as TodayRestaurantRow[]

  return (
    <main className="min-h-screen bg-canvas px-6 pt-6 pb-24">
      <div className="mx-auto w-full max-w-md">
        <PageHeader title="おすすめのお店" back={{ href: changeHref }} />

        {/* 条件chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {conditionLabels.length > 0 ? (
            <>
              {conditionLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-terra bg-cream px-3 py-1 text-xs font-medium text-terra"
                >
                  {label}
                </span>
              ))}
            </>
          ) : (
            <span className="text-sm text-ink-sub">条件なし</span>
          )}
          <Link
            href={changeHref}
            className="ml-auto text-sm font-medium text-terra transition-colors hover:text-terra-deep"
          >
            条件を変更
          </Link>
        </div>

        {/* 件数 + 補足 */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="tabular-nums text-sm text-ink-sub">{restaurants.length}件</p>
          {restaurants.length > 0 && (
            <p className="text-xs text-ink-sub">FoodKitの記録をもとにおすすめ</p>
          )}
        </div>

        {restaurants.length > 0 ? (
          <ul className="mt-4 space-y-3" aria-label="おすすめのお店">
            {restaurants.map((r) => (
              <li key={r.restaurant_id}>
                <Link href={`/restaurants/${r.restaurant_id}`} prefetch={false}>
                  <Card interactive className="p-4">
                    <p className="font-medium text-ink">{r.name}</p>
                    {(r.area || r.genre) && (
                      <p className="mt-1 text-sm text-ink-sub">
                        {[r.area, r.genre].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {r.budget_per_person_max_yen != null && (
                      <p className="mt-1 text-sm text-ink-sub">
                        ¥{r.budget_per_person_max_yen.toLocaleString()}以下/人
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
              title="条件に合うお店が見つかりませんでした"
              description={
                conditionLabels.length > 0
                  ? `現在の条件：${conditionLabels.join('・')}`
                  : undefined
              }
              action={
                <div className="w-full space-y-3">
                  <Link
                    href={changeHref}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-colors hover:bg-terra-deep"
                  >
                    条件を変更する
                  </Link>
                  <Link
                    href="/search/today/results"
                    className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-edge bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-canvas"
                  >
                    条件をクリアして探す
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
