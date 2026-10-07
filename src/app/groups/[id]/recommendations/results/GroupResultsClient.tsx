'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  getGroupActiveLabels,
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
}

export default function GroupResultsClient({
  groupId,
  partyTag,
  params,
  validMemberCount,
  changeHref,
}: Props) {
  const [status, setStatus] = useState<Status>(
    params.transport && params.travel !== null ? { kind: 'geo_pending' } : { kind: 'loading' },
  )

  const conditionLabels = getGroupActiveLabels(params)

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

  return (
    <>
      {conditionLabels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {conditionLabels.map((label) => (
            <span
              key={label}
              className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-amber-800"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {status.kind === 'geo_pending' && (
        <div className="rounded-2xl border border-edge bg-surface px-5 py-8 text-center">
          <p className="text-sm text-ink-sub">現在地を取得しています…</p>
        </div>
      )}

      {status.kind === 'geo_error' && (
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
            className="flex min-h-11 w-full items-center justify-center rounded-full bg-terra text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            現在地を再取得
          </button>
          <Link
            href={clearTravelHref()}
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-edge bg-surface text-sm font-medium text-ink transition-colors hover:bg-canvas"
          >
            移動条件を外して検索
          </Link>
        </div>
      )}

      {status.kind === 'loading' && (
        <div className="rounded-2xl border border-edge bg-surface px-5 py-8 text-center">
          <p className="text-sm text-ink-sub">検索中…</p>
        </div>
      )}

      {status.kind === 'rpc_error' && (
        <div className="space-y-4 rounded-2xl border border-edge bg-surface px-5 py-6">
          <p className="text-sm text-red-600">おすすめの取得に失敗しました。</p>
          <Link
            href={changeHref}
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-edge bg-surface text-sm font-medium text-ink transition-colors hover:bg-canvas"
          >
            条件を変更する
          </Link>
        </div>
      )}

      {status.kind === 'done' && status.restaurants.length === 0 && validMemberCount === 0 && (
        <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-ink">メンバーの食の好みデータがまだ足りません</p>
          <p className="mt-2 text-xs leading-5 text-ink-sub">
            グループメンバー全員がFoodKitで5枚以上の好みカードを設定すると、
            グループのおすすめが表示されます。
          </p>
        </div>
      )}

      {status.kind === 'done' && status.restaurants.length === 0 && validMemberCount > 0 && (
        <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-medium text-ink">条件に合うおすすめが見つかりませんでした</p>
          <p className="mt-2 text-xs leading-5 text-ink-sub">
            条件を変えてもう一度試してみてください。
          </p>
          <div className="mt-5 space-y-3">
            <Link
              href={changeHref}
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
      )}

      {status.kind === 'done' && status.restaurants.length > 0 && (
        <>
          <p className="text-xs text-ink-sub">{status.restaurants.length}件のおすすめ</p>
          <ul className="space-y-3">
            {status.restaurants.map((rec) => (
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
    </>
  )
}
