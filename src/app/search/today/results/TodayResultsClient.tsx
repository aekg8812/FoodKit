'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Card from '@/components/ui/Card'
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
      {/* 条件chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {conditionLabels.length > 0 ? (
          conditionLabels.map((label) => (
            <span
              key={label}
              className="rounded-full border border-terra bg-cream px-3 py-1 text-xs font-medium text-terra"
            >
              {label}
            </span>
          ))
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

      {/* Geolocation取得中 */}
      {status.kind === 'geo_pending' && (
        <div className="mt-8 text-center text-sm text-ink-sub">現在地を取得しています…</div>
      )}

      {/* Geolocationエラー */}
      {status.kind === 'geo_error' && (
        <div className="mt-8 space-y-4">
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
            className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-colors hover:bg-terra-deep"
          >
            現在地を再取得
          </button>
          <Link
            href={clearTravelHref()}
            className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-edge bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-canvas"
          >
            移動条件を外して検索
          </Link>
        </div>
      )}

      {/* RPC読み込み中 */}
      {status.kind === 'loading' && (
        <div className="mt-8 text-center text-sm text-ink-sub">検索中…</div>
      )}

      {/* RPCエラー */}
      {status.kind === 'rpc_error' && (
        <div className="mt-8 space-y-4">
          <ErrorMessage message="おすすめ店舗の取得に失敗しました。時間をおいてもう一度お試しください。" />
          <Link
            href={changeHref}
            className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-edge bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-canvas"
          >
            条件を変更する
          </Link>
        </div>
      )}

      {/* 結果 */}
      {status.kind === 'done' && (
        <>
          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="tabular-nums text-sm text-ink-sub">{status.restaurants.length}件</p>
            {status.restaurants.length > 0 && (
              <p className="text-xs text-ink-sub">FoodKitの記録をもとにおすすめ</p>
            )}
          </div>

          {status.restaurants.length > 0 ? (
            <ul className="mt-4 space-y-3" aria-label="おすすめのお店">
              {status.restaurants.map((r) => (
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
        </>
      )}
    </>
  )
}
