'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { type MainValueType, VALUE_TYPE_LABEL } from '@/lib/onboarding/classifyValueType'

export type RestaurantRow = {
  id: string
  name: string
  area: string | null
  genre: string | null
  created_at: string
}

export type ReviewRow = {
  restaurant_id: string
  rating: number
  user_id: string
}

export type ProfileRow = {
  user_id: string
  main_value_type: string | null
}

type FilterType = MainValueType | 'all'

type Distribution = {
  total: number
  counts: Record<1 | 2 | 3 | 4, number>
  percents: Record<1 | 2 | 3 | 4, number>
}

interface Props {
  restaurants: RestaurantRow[]
  reviews: ReviewRow[]
  profiles: ProfileRow[]
  currentUserId: string
}

const FILTER_OPTIONS: Array<{ value: FilterType; label: string }> = [
  { value: 'all', label: '全員' },
  { value: 'taste', label: VALUE_TYPE_LABEL.taste },
  { value: 'cost', label: VALUE_TYPE_LABEL.cost },
  { value: 'atmosphere', label: VALUE_TYPE_LABEL.atmosphere },
  { value: 'hospitality', label: VALUE_TYPE_LABEL.hospitality },
]

const RATING_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: 'bg-emerald-500',
  3: 'bg-sky-400',
  2: 'bg-amber-400',
  1: 'bg-red-400',
}

const RATINGS = [4, 3, 2, 1] as const

function computeDistribution(
  restaurantId: string,
  reviews: ReviewRow[],
  eligibleUserIds: Set<string> | null,
): Distribution {
  const counts: Record<1 | 2 | 3 | 4, number> = { 4: 0, 3: 0, 2: 0, 1: 0 }

  const relevant = reviews.filter(
    (r) =>
      r.restaurant_id === restaurantId &&
      (eligibleUserIds === null || eligibleUserIds.has(r.user_id)),
  )

  const total = relevant.length
  if (total === 0) {
    return { total: 0, counts, percents: { 4: 0, 3: 0, 2: 0, 1: 0 } }
  }

  for (const r of relevant) {
    counts[r.rating as 1 | 2 | 3 | 4]++
  }

  return {
    total,
    counts,
    percents: {
      4: Math.round((counts[4] / total) * 100),
      3: Math.round((counts[3] / total) * 100),
      2: Math.round((counts[2] / total) * 100),
      1: Math.round((counts[1] / total) * 100),
    },
  }
}

function DistributionDisplay({
  dist,
  countLabel,
  emptyMessage,
}: {
  dist: Distribution
  countLabel: string
  emptyMessage: string
}) {
  if (dist.total === 0) {
    return <p className="mt-2 text-xs text-zinc-400">{emptyMessage}</p>
  }

  return (
    <div className="mt-3">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        {RATINGS.map((r) =>
          dist.counts[r] > 0 ? (
            <div
              key={r}
              style={{ width: `${dist.percents[r]}%` }}
              className={RATING_COLORS[r]}
            />
          ) : null,
        )}
      </div>
      <div className="mt-1 flex gap-3 text-xs">
        {RATINGS.map((r) => (
          <span key={r} className={dist.counts[r] === 0 ? 'text-zinc-300' : 'text-zinc-500'}>
            {r}: {dist.percents[r]}%
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-xs text-zinc-400">
        {countLabel}&nbsp;{dist.total}人の評価
      </p>
    </div>
  )
}

export default function RestaurantListClient({
  restaurants,
  reviews,
  profiles,
  currentUserId,
}: Props) {
  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.user_id, p.main_value_type])),
    [profiles],
  )

  const myValueType = (profileMap.get(currentUserId) ?? null) as MainValueType | null

  const [filter, setFilter] = useState<FilterType>(myValueType ?? 'all')

  const sortedRestaurants = useMemo(() => {
    // Compute once per filter change
    const eligibleUserIds: Set<string> | null =
      filter === 'all'
        ? null
        : new Set(
            [...profileMap.entries()]
              .filter(([, type]) => type === filter)
              .map(([id]) => id),
          )

    const withDist = restaurants.map((r) => ({
      restaurant: r,
      dist: computeDistribution(r.id, reviews, eligibleUserIds),
    }))

    return withDist.sort((a, b) => {
      const aTotal = a.dist.total
      const bTotal = b.dist.total

      // 0件は最下部
      if (aTotal === 0 && bTotal === 0) {
        return (
          new Date(b.restaurant.created_at).getTime() -
          new Date(a.restaurant.created_at).getTime()
        )
      }
      if (aTotal === 0) return 1
      if (bTotal === 0) return -1

      // 高評価率（星4+3）の降順 — 分数比較を交差乗算で行う（浮動小数点誤差なし）
      const aHigh = a.dist.counts[4] + a.dist.counts[3]
      const bHigh = b.dist.counts[4] + b.dist.counts[3]
      const cross = bHigh * aTotal - aHigh * bTotal
      if (cross !== 0) return cross

      // 母数の降順
      if (bTotal !== aTotal) return bTotal - aTotal

      // created_at の新しい順
      return (
        new Date(b.restaurant.created_at).getTime() -
        new Date(a.restaurant.created_at).getTime()
      )
    })
  }, [restaurants, reviews, profileMap, filter])

  const countLabel = filter === 'all' ? '全員' : VALUE_TYPE_LABEL[filter as MainValueType]
  const emptyMessage =
    filter === 'all'
      ? 'まだ評価がありません'
      : `${VALUE_TYPE_LABEL[filter as MainValueType]}の評価はまだありません`

  const headerAndFooter = (children: React.ReactNode) => (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-950">店舗一覧</h1>
          <Link
            href="/restaurants/new"
            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            ＋ 登録
          </Link>
        </div>
        {children}
        <div className="mt-6">
          <Link href="/home" className="text-sm text-zinc-500 hover:text-zinc-700">
            ← ホームに戻る
          </Link>
        </div>
      </div>
    </main>
  )

  if (restaurants.length === 0) {
    return headerAndFooter(
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="mb-4 text-sm text-zinc-600">まだ店舗がありません。登録してみましょう。</p>
        <Link
          href="/restaurants/new"
          className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          店舗を登録
        </Link>
      </div>,
    )
  }

  return headerAndFooter(
    <>
      {/* 自分の価値観タイプ */}
      <p className="mb-4 text-sm text-zinc-500">
        {myValueType ? (
          <>
            あなたは{' '}
            <span className="font-medium text-zinc-950">{VALUE_TYPE_LABEL[myValueType]}</span>{' '}
            タイプ
          </>
        ) : (
          '価値観タイプが未設定です'
        )}
      </p>

      {/* フィルタ */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(opt.value)}
            className={
              filter === opt.value
                ? 'shrink-0 rounded-full bg-zinc-950 px-4 py-1.5 text-sm font-medium text-white'
                : 'shrink-0 rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50'
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 店舗リスト */}
      <ul className="space-y-3">
        {sortedRestaurants.map(({ restaurant: r, dist }) => (
          <li key={r.id}>
            <Link
              href={`/restaurants/${r.id}`}
              className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50"
            >
              <p className="font-medium text-zinc-950">{r.name}</p>
              {(r.area || r.genre) && (
                <p className="mt-1 text-sm text-zinc-500">
                  {[r.area, r.genre].filter(Boolean).join(' · ')}
                </p>
              )}
              <DistributionDisplay
                dist={dist}
                countLabel={countLabel}
                emptyMessage={emptyMessage}
              />
            </Link>
          </li>
        ))}
      </ul>
    </>,
  )
}
