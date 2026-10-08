'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import EmptyState from '@/components/ui/EmptyState'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/client'
import {
  getActiveConditionLabels,
  serializeTodaySearchParams,
  getMaxDistanceKm,
  FOOD_TO_GENRE,
  type TodaySearchParams,
} from '@/lib/restaurants/todaySearch'

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

type Status =
  | { kind: 'geo_pending' }
  | { kind: 'loading' }
  | { kind: 'geo_error'; message: string }
  | { kind: 'rpc_error'; message: string }
  | { kind: 'done'; restaurants: TodayRestaurantRow[] }

type Props = {
  params: TodaySearchParams
  changeHref: string
}

export default function TodayResultsClient({ params, changeHref }: Props) {
  const [status, setStatus] = useState<Status>(
    params.transport && params.travel !== null
      ? { kind: 'geo_pending' }
      : { kind: 'loading' }
  )

  const conditionLabels = getActiveConditionLabels(params)

  async function fetchResults(userLat?: number, userLng?: number) {
    const supabase = createClient()

    const maxDistanceKm =
      params.transport && params.travel !== null && userLat !== undefined && userLng !== undefined
        ? getMaxDistanceKm(params.transport, params.travel)
        : undefined

    const { data, error } = await supabase.rpc('get_today_restaurants', {
      p_party_tag: params.party ?? null,
      p_budget_max: params.budget ?? null,
      p_genre: params.food ? FOOD_TO_GENRE[params.food] : null,
      p_atmosphere_tag: params.vibe ?? null,
      p_walk_in: params.walkIn,
      p_parking: params.parking,
      p_limit: 20,
      p_open_now: params.openNow,
      p_user_lat: userLat ?? null,
      p_user_lng: userLng ?? null,
      p_max_distance_km: maxDistanceKm ?? null,
    })

    if (error) {
      setStatus({ kind: 'rpc_error', message: error.message })
      return
    }

    setStatus({ kind: 'done', restaurants: (data ?? []) as TodayRestaurantRow[] })
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
            message: '現在地を取得できないため、移動時間条件を使用できません。',
          })
        },
        { timeout: 10000, maximumAge: 60000 }
      )
    } else {
      // fetchResults only sets state after an await — not synchronous in the effect body
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchResults()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function clearTravelHref() {
    const withoutTravel = serializeTodaySearchParams({
      ...params,
      transport: null,
      travel: null,
    }).toString()
    return `/search/today/results${withoutTravel ? `?${withoutTravel}` : ''}`
  }

  return (
    <>
      {/* Condition chips row + 条件を変更 */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-3">
        {conditionLabels.length > 0 ? (
          conditionLabels.map((label) => (
            <span
              key={label}
              className="shrink-0 rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-ink"
            >
              {label}
            </span>
          ))
        ) : (
          <span className="text-sm text-ink-sub">条件なし</span>
        )}
        <Link
          href={changeHref}
          className="ml-auto shrink-0 rounded-full border border-terra bg-terra/5 px-3 py-1 text-xs font-bold text-terra"
        >
          条件を変更
        </Link>
      </div>

      {/* Geolocation取得中 */}
      {status.kind === 'geo_pending' && (
        <div className="mt-8 text-center text-sm text-ink-sub">現在地を取得しています…</div>
      )}

      {/* Geolocationエラー */}
      {status.kind === 'geo_error' && (
        <div className="mt-8 space-y-4 px-4">
          <ErrorMessage message={status.message} />
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
                    message: '現在地を取得できないため、移動時間条件を使用できません。',
                  }),
                { timeout: 10000, maximumAge: 0 }
              )
            }}
            className="flex h-[44px] w-full items-center justify-center rounded-xl bg-terra text-sm font-medium text-white"
          >
            現在地を再取得
          </button>
          <Link
            href={clearTravelHref()}
            className="flex h-[44px] w-full items-center justify-center rounded-full border border-edge bg-surface text-sm font-medium text-ink"
          >
            移動条件を外して検索
          </Link>
        </div>
      )}

      {/* 読み込み中 */}
      {status.kind === 'loading' && (
        <div className="mt-8 text-center text-sm text-ink-sub">検索中…</div>
      )}

      {/* RPCエラー */}
      {status.kind === 'rpc_error' && (
        <div className="mt-8 space-y-4 px-4">
          <ErrorMessage message="おすすめ店舗の取得に失敗しました。時間をおいてもう一度お試しください。" />
          <Link
            href={changeHref}
            className="flex h-[44px] w-full items-center justify-center rounded-full border border-edge bg-surface text-sm font-medium text-ink"
          >
            条件を変更する
          </Link>
        </div>
      )}

      {/* 結果 */}
      {status.kind === 'done' && (
        <>
          {/* Count + sort */}
          <div className="flex items-center justify-between px-4 pb-3">
            <p className="text-sm font-medium text-ink">
              おすすめ <span className="font-black text-ink">{status.restaurants.length}</span> 件
            </p>
            <button type="button" className="flex items-center gap-1 rounded-full border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-ink">
              おすすめ順
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>

          {status.restaurants.length > 0 ? (
            <ul className="space-y-4 px-4" aria-label="おすすめのお店">
              {status.restaurants.map((r) => (
                <li key={r.restaurant_id}>
                  <Link href={`/restaurants/${r.restaurant_id}`} prefetch={false} className="block overflow-hidden rounded-2xl bg-surface">
                    {/* Full-width food photo */}
                    <div className="h-[180px] w-full bg-[#F3E5D8]">
                      <div className="flex h-full w-full items-center justify-center">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                          <line x1="6" y1="1" x2="6" y2="4" />
                          <line x1="10" y1="1" x2="10" y2="4" />
                          <line x1="14" y1="1" x2="14" y2="4" />
                        </svg>
                      </div>
                    </div>

                    {/* Info below photo */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-ink">{r.name}</p>
                          {(r.area || r.genre) && (
                            <p className="mt-0.5 text-xs text-ink-sub">
                              {[r.genre, r.area].filter(Boolean).join('・')}
                            </p>
                          )}
                        </div>
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="mt-0.5 shrink-0 text-ink-sub" aria-hidden="true">
                          <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>

                      {/* Price + distance */}
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-sub">
                        {r.budget_per_person_max_yen != null && (
                          <span className="flex items-center gap-0.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 6v12M9 9h4.5a2 2 0 0 1 0 4H9a2 2 0 0 0 0 4h5" />
                            </svg>
                            ¥{r.budget_per_person_max_yen.toLocaleString()}以下
                          </span>
                        )}
                      </div>

                      {/* Evidence badge */}
                      {r.same_type_review_count > 0 && (
                        <div className="mt-3 rounded-lg bg-[#FFF3EC] px-3 py-2">
                          <p className="flex items-center gap-1.5 text-xs font-bold text-terra">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
                              <circle cx="9" cy="7" r="4" stroke="#F97316" strokeWidth="2" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            好みが近い人の多くが「また行きたい」
                          </p>
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-8 px-4">
              <EmptyState
                icon={
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                }
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
                      className="flex h-[44px] w-full items-center justify-center rounded-xl bg-terra text-sm font-medium text-white"
                    >
                      条件を変更する
                    </Link>
                    <Link
                      href="/search/today/results"
                      className="flex h-[44px] w-full items-center justify-center rounded-full border border-edge bg-surface text-sm font-medium text-ink"
                    >
                      条件をクリアして探す
                    </Link>
                  </div>
                }
              />
            </div>
          )}
        </>
      )}
    </>
  )
}
