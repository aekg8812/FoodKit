import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { FOOD_VALUES, FOOD_TO_GENRE, VIBE_VALUES, type FoodValue, type VibeValue } from '@/lib/restaurants/todaySearch'

type RecommendationRow = {
  restaurant_id: string
  name: string
  area: string | null
  genre: string | null
  address: string | null
  budget_per_person_max_yen: number | null
  walk_in_available: boolean | null
  parking_available: boolean | null
  coverage_count: number
  valid_member_count: number
  coverage_ratio: number
  group_score: number
  review_evidence_count: number
}

type GroupResultsPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getStr(raw: Record<string, string | string[] | undefined>, key: string): string {
  const v = raw[key]
  return ((Array.isArray(v) ? v[0] : v) ?? '').trim()
}

function memberCountToPartyTag(count: number): string {
  if (count <= 1) return 'solo'
  if (count === 2) return 'pair'
  if (count <= 4) return 'small_group'
  return 'large_group'
}

export default async function GroupResultsPage({ params, searchParams }: GroupResultsPageProps) {
  const { id: groupId } = await params
  const raw = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [groupResult, membersResult] = await Promise.all([
    supabase.from('groups').select('id, name').eq('id', groupId).maybeSingle(),
    supabase.from('group_members').select('user_id').eq('group_id', groupId),
  ])

  if (groupResult.error) throw new Error('グループ情報を読み込めませんでした。')
  if (!groupResult.data) notFound()

  const group = groupResult.data as { id: string; name: string }
  const memberCount = (membersResult.data ?? []).length
  const partyTag = memberCountToPartyTag(memberCount)

  // Parse URL conditions
  const budgetRaw = Number(getStr(raw, 'budget'))
  const pBudgetMax = [1000, 2000, 3000].includes(budgetRaw) ? budgetRaw : null

  const foodRaw = getStr(raw, 'food') as FoodValue
  const pGenre = (FOOD_VALUES as readonly string[]).includes(foodRaw)
    ? FOOD_TO_GENRE[foodRaw]
    : null

  const vibeRaw = getStr(raw, 'vibe') as VibeValue
  const pAtmosphereTag = (VIBE_VALUES as readonly string[]).includes(vibeRaw) ? vibeRaw : null

  const mealRaw = getStr(raw, 'meal')
  const pMealPeriod = ['lunch', 'dinner'].includes(mealRaw) ? mealRaw : null

  const pWalkIn = getStr(raw, 'walk_in') === '1' ? true : null
  const pParking = getStr(raw, 'parking') === '1' ? true : null
  const pOpenNow = getStr(raw, 'open_now') === '1' ? true : null

  const latRaw = parseFloat(getStr(raw, 'lat'))
  const lngRaw = parseFloat(getStr(raw, 'lng'))
  const kmRaw = parseFloat(getStr(raw, 'km'))
  const pUserLat = isFinite(latRaw) ? latRaw : null
  const pUserLng = isFinite(lngRaw) ? lngRaw : null
  const pMaxDistanceKm = isFinite(kmRaw) && kmRaw > 0 ? kmRaw : null

  const { data: recData, error: recError } = await supabase.rpc('get_group_recommendations_v2', {
    p_group_id: groupId,
    p_party_tag: partyTag,
    p_budget_max: pBudgetMax,
    p_genre: pGenre,
    p_atmosphere_tag: pAtmosphereTag,
    p_walk_in: pWalkIn,
    p_parking: pParking,
    p_open_now: pOpenNow,
    p_meal_period: pMealPeriod,
    p_user_lat: pUserLat,
    p_user_lng: pUserLng,
    p_max_distance_km: pMaxDistanceKm,
    p_limit: 20,
  })

  if (recError) {
    console.error('GroupResultsPage: RPC failed', recError)
    throw new Error('おすすめを読み込めませんでした。')
  }

  const recommendations = (recData ?? []) as RecommendationRow[]

  // Build active condition labels for display
  const activeLabels: string[] = []
  if (pBudgetMax) activeLabels.push(`¥${pBudgetMax.toLocaleString()}以下`)
  if (pGenre) activeLabels.push(pGenre)
  if (pAtmosphereTag === 'lively') activeLabels.push('にぎやか')
  if (pAtmosphereTag === 'relaxed') activeLabels.push('ゆっくり')
  if (pAtmosphereTag === 'casual') activeLabels.push('気軽')
  if (pMealPeriod === 'lunch') activeLabels.push('ランチ')
  if (pMealPeriod === 'dinner') activeLabels.push('ディナー')
  if (pWalkIn) activeLabels.push('飛び込みOK')
  if (pParking) activeLabels.push('駐車場あり')
  if (pOpenNow) activeLabels.push('営業中')
  if (pUserLat !== null && pUserLng !== null && pMaxDistanceKm !== null) {
    activeLabels.push(`現在地から${pMaxDistanceKm}km以内`)
  }

  const conditionsHref = `/groups/${groupId}/recommendations/conditions`

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 pb-20">
      <div className="mx-auto max-w-md space-y-4">
        <Suspense>
          <BackButton fallbackHref={conditionsHref} label="← 条件を変更" />
        </Suspense>

        <div>
          <p className="text-xs text-ink-sub">{group.name}</p>
          <h1 className="text-xl font-bold text-ink">条件付きおすすめ</h1>
        </div>

        {activeLabels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeLabels.map((label) => (
              <span
                key={label}
                className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-amber-800"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {recommendations.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-ink">条件に合うおすすめが見つかりませんでした</p>
            <p className="mt-2 text-xs leading-5 text-ink-sub">
              条件を変えてもう一度試してみてください。
            </p>
            <div className="mt-5 space-y-3">
              <Link
                href={conditionsHref}
                className="flex min-h-11 items-center justify-center rounded-full bg-terra text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                条件を変更する
              </Link>
              <Link
                href={`/groups/${groupId}/recommendations`}
                className="flex min-h-11 items-center justify-center rounded-full border border-edge bg-surface text-sm font-medium text-ink transition-colors hover:bg-canvas"
              >
                条件なしで見る
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-ink-sub">{recommendations.length}件のおすすめ</p>
            <ul className="space-y-3">
              {recommendations.map((rec) => (
                <li key={rec.restaurant_id}>
                  <Link
                    href={`/restaurants/${rec.restaurant_id}`}
                    className="block rounded-2xl border border-edge bg-surface p-4 shadow-sm transition-colors hover:bg-canvas"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{rec.name}</p>
                        {(rec.genre ?? rec.area) && (
                          <p className="mt-0.5 truncate text-xs text-ink-sub">
                            {[rec.genre, rec.area].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {rec.budget_per_person_max_yen && (
                          <p className="mt-0.5 text-xs text-ink-sub">
                            〜¥{rec.budget_per_person_max_yen.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-terra">
                          {Math.round(rec.coverage_ratio * 100)}%
                        </p>
                        <p className="text-[10px] text-ink-sub">
                          {rec.coverage_count}/{rec.valid_member_count}人
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
