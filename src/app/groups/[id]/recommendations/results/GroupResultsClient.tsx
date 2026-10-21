'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  serializeGroupSearchParams,
  getMaxDistanceKm,
  FOOD_TO_GENRE,
  type GroupSearchParams,
} from '@/lib/restaurants/groupSearch'

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

type Status =
  | { kind: 'geo_pending' }
  | { kind: 'loading' }
  | { kind: 'geo_error'; message: string }
  | { kind: 'rpc_error'; message: string }
  | { kind: 'done'; restaurants: RecommendationRow[] }

type Props = {
  groupId: string
  partyTag: string
  params: GroupSearchParams
  validMemberCount: number
  changeHref: string
  memberCount: number
}

export default function GroupResultsClient({
  groupId,
  partyTag,
  params,
  validMemberCount,
  changeHref,
  memberCount,
}: Props) {
  const [status, setStatus] = useState<Status>(
    params.transport && params.travel !== null ? { kind: 'geo_pending' } : { kind: 'loading' },
  )

  async function fetchResults(userLat?: number, userLng?: number) {
    const supabase = createClient()

    const maxDistanceKm =
      params.transport && params.travel !== null && userLat !== undefined && userLng !== undefined
        ? getMaxDistanceKm(params.transport, params.travel)
        : undefined

    const { data, error } = await supabase.rpc('get_group_recommendations_v2', {
      p_group_id: groupId,
      p_party_tag: partyTag,
      p_budget_max: params.budget ?? null,
      p_genre: params.food ? FOOD_TO_GENRE[params.food] : null,
      p_atmosphere_tag: params.vibe ?? null,
      p_walk_in: params.walkIn || null,
      p_parking: params.parking || null,
      p_open_now: params.openNow || null,
      p_meal_period: params.meal ?? null,
      p_user_lat: userLat ?? null,
      p_user_lng: userLng ?? null,
      p_max_distance_km: maxDistanceKm ?? null,
      p_limit: 20,
    })

    if (error) {
      setStatus({ kind: 'rpc_error', message: error.message })
      return
    }

    setStatus({ kind: 'done', restaurants: (data ?? []) as RecommendationRow[] })
  }

  useEffect(() => {
    if (params.transport && params.travel !== null) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setStatus({ kind: 'loading' })
          fetchResults(pos.coords.latitude, pos.coords.longitude)
        },
        () => {
          setStatus({
            kind: 'geo_error',
            message: '現在地を取得できませんでした。移動条件を外すか、再取得してください。',
          })
        },
        { timeout: 10000, maximumAge: 60000 },
      )
    } else {
      // fetchResults only sets state after an await — not synchronous in the effect body
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchResults()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function clearTravelHref() {
    const withoutTravel = serializeGroupSearchParams({
      ...params,
      transport: null,
      travel: null,
    }).toString()
    return `/groups/${groupId}/recommendations/results${withoutTravel ? `?${withoutTravel}` : ''}`
  }

  if (status.kind === 'geo_pending') {
    return (
      <div className="rounded-2xl border border-edge bg-surface px-5 py-8 text-center">
        <p className="text-sm text-ink-sub">現在地を取得しています…</p>
      </div>
    )
  }

  if (status.kind === 'geo_error') {
    return (
      <div className="space-y-4 rounded-2xl border border-edge bg-surface px-5 py-6">
        <p className="text-sm text-red-600">{status.message}</p>
        <button
          type="button"
          onClick={() => {
            setStatus({ kind: 'geo_pending' })
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setStatus({ kind: 'loading' })
                fetchResults(pos.coords.latitude, pos.coords.longitude)
              },
              () =>
                setStatus({
                  kind: 'geo_error',
                  message: '現在地を取得できませんでした。移動条件を外すか、再取得してください。',
                }),
              { timeout: 10000, maximumAge: 0 },
            )
          }}
          className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-terra text-sm font-bold text-white"
        >
          現在地を再取得
        </button>
        <Link
          href={clearTravelHref()}
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-edge bg-surface text-sm font-medium text-ink"
        >
          移動条件を外して検索
        </Link>
      </div>
    )
  }

  if (status.kind === 'loading') {
    return (
      <div className="rounded-2xl border border-edge bg-surface px-5 py-8 text-center">
        <p className="text-sm text-ink-sub">検索中…</p>
      </div>
    )
  }

  if (status.kind === 'rpc_error') {
    return (
      <div className="space-y-4 rounded-2xl border border-edge bg-surface px-5 py-6">
        <p className="text-sm text-red-600">おすすめの取得に失敗しました。</p>
        <Link href={changeHref} className="flex min-h-11 w-full items-center justify-center rounded-xl border border-edge bg-surface text-sm font-medium text-ink">
          条件を変更する
        </Link>
      </div>
    )
  }

  const { restaurants } = status

  if (restaurants.length === 0 && validMemberCount === 0) {
    return (
      <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center">
        <p className="text-sm font-medium text-ink">メンバーの食の好みデータがまだ足りません</p>
        <p className="mt-2 text-xs leading-5 text-ink-sub">
          グループメンバー全員がFoodKitで5枚以上の好みカードを設定すると、グループのおすすめが表示されます。
        </p>
      </div>
    )
  }

  if (restaurants.length === 0) {
    return (
      <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center">
        <p className="text-sm font-medium text-ink">条件に合うおすすめが見つかりませんでした</p>
        <p className="mt-2 text-xs leading-5 text-ink-sub">
          条件を変えてもう一度試してみてください。
        </p>
        <div className="mt-5 space-y-3">
          <Link
            href={changeHref}
            className="flex min-h-[52px] items-center justify-center rounded-xl bg-terra text-sm font-bold text-white"
          >
            条件を変更する
          </Link>
          <Link
            href={`/groups/${groupId}/recommendations`}
            className="flex min-h-11 items-center justify-center rounded-xl border border-edge bg-surface text-sm font-medium text-ink"
          >
            条件なしで見る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-ink">
          おすすめ <span className="text-terra">{restaurants.length}</span>件
        </p>
      </div>

      <ul className="space-y-3">
        {restaurants.map((rec) => (
          <li key={rec.restaurant_id}>
            <Link
              href={`/restaurants/${rec.restaurant_id}`}
              className="block overflow-hidden rounded-2xl border border-edge bg-surface transition-colors hover:bg-canvas"
            >
              <div className="flex gap-3 p-3">
                {/* Photo placeholder */}
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                    <line x1="6" y1="1" x2="6" y2="4" />
                    <line x1="10" y1="1" x2="10" y2="4" />
                    <line x1="14" y1="1" x2="14" y2="4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">{rec.name}</p>
                  {(rec.genre ?? rec.area) && (
                    <p className="mt-0.5 text-xs text-ink-sub">
                      {[rec.genre, rec.area].filter(Boolean).join('・')}
                    </p>
                  )}
                  {rec.budget_per_person_max_yen && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-sub">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9 12h6M9 8h6M12 16v-8" />
                      </svg>
                      〜¥{rec.budget_per_person_max_yen.toLocaleString()}
                    </p>
                  )}
                </div>
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="mt-1 shrink-0 text-ink-sub" aria-hidden="true">
                  <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Match section */}
              <div className="bg-terra/10 px-3 pb-3 pt-2">
                <p className="flex items-center gap-1.5 text-xs font-bold text-terra">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  {memberCount}人中{rec.coverage_count}人の好みに合っています
                </p>
                {rec.review_evidence_count > 0 && (
                  <p className="mt-1 text-xs text-terra/80">
                    {rec.review_evidence_count}人が高評価を記録
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
