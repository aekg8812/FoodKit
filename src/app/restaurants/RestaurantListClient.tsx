'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { type MainValueType, VALUE_TYPE_LABEL } from '@/lib/onboarding/classifyValueType'
import BottomNav from '@/components/BottomNav'
import Card from '@/components/ui/Card'
import ValueTypeBadge from '@/components/ValueTypeBadge'
import DistributionDisplay from '@/components/DistributionDisplay'
import {
  buildProfileMap,
  buildEligibleUserIds,
  sortRestaurants,
} from '@/lib/restaurants/aggregate'

export type { RestaurantRow, ReviewRow, ProfileRow } from '@/lib/restaurants/aggregate'

type FilterType = MainValueType | 'all'

interface Props {
  restaurants: import('@/lib/restaurants/aggregate').RestaurantRow[]
  reviews: import('@/lib/restaurants/aggregate').ReviewRow[]
  profiles: import('@/lib/restaurants/aggregate').ProfileRow[]
  currentUserId: string
}

const FILTER_OPTIONS: Array<{ value: FilterType; label: string }> = [
  { value: 'all', label: '全員' },
  { value: 'taste', label: VALUE_TYPE_LABEL.taste },
  { value: 'cost', label: VALUE_TYPE_LABEL.cost },
  { value: 'atmosphere', label: VALUE_TYPE_LABEL.atmosphere },
  { value: 'hospitality', label: VALUE_TYPE_LABEL.hospitality },
]

export default function RestaurantListClient({
  restaurants,
  reviews,
  profiles,
  currentUserId,
}: Props) {
  const profileMap = useMemo(() => buildProfileMap(profiles), [profiles])

  const myValueType = (profileMap.get(currentUserId) ?? null) as MainValueType | null

  const [filter, setFilter] = useState<FilterType>(myValueType ?? 'all')

  const sortedRestaurants = useMemo(() => {
    const eligibleUserIds = buildEligibleUserIds(profileMap, filter === 'all' ? null : filter)
    return sortRestaurants(restaurants, reviews, eligibleUserIds)
  }, [restaurants, reviews, profileMap, filter])

  const countLabel = filter === 'all' ? '全員' : VALUE_TYPE_LABEL[filter as MainValueType]
  const emptyMessage =
    filter === 'all'
      ? 'まだ評価がありません'
      : `${VALUE_TYPE_LABEL[filter as MainValueType]}の評価はまだありません`

  const pageHeader = (
    <div className="mb-5 flex items-center justify-between">
      <h1 className="text-2xl font-bold text-ink">店舗一覧</h1>
      <Link
        href="/restaurants/new"
        className="inline-flex min-h-[44px] items-center rounded-full bg-terra px-4 text-sm font-medium text-white transition-all duration-150 hover:bg-terra-deep motion-safe:active:scale-[0.98]"
      >
        ＋ 登録
      </Link>
    </div>
  )

  if (restaurants.length === 0) {
    return (
      <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
        <div className="mx-auto max-w-md">
          {pageHeader}
          <Card className="p-8 text-center">
            <p className="mb-2 text-3xl" aria-hidden="true">🍽️</p>
            <p className="mb-5 text-sm text-ink-sub">まだ店舗がありません。登録してみましょう。</p>
            <Link
              href="/restaurants/new"
              className="inline-flex min-h-[44px] items-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-all duration-150 hover:bg-terra-deep motion-safe:active:scale-[0.98]"
            >
              店舗を登録
            </Link>
          </Card>
        </div>
        <BottomNav />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <div className="mx-auto max-w-md">
        {pageHeader}

        {/* 自分の価値観タイプ */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-sub">あなたのタイプ：</span>
          <ValueTypeBadge type={myValueType} />
        </div>

        {/* フィルタ */}
        <div className="mb-5 flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={
                filter === opt.value
                  ? 'min-h-[44px] rounded-full bg-terra px-4 py-1.5 text-sm font-medium text-white transition-all duration-150'
                  : 'min-h-[44px] rounded-full border border-edge px-4 py-1.5 text-sm font-medium text-ink transition-all duration-150 hover:bg-canvas motion-safe:active:scale-[0.98]'
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
              <Link href={`/restaurants/${r.id}`} className="block">
                <Card interactive className="p-4">
                  <p className="font-medium text-ink">{r.name}</p>
                  {(r.area || r.genre) && (
                    <p className="mt-1 text-sm text-ink-sub">
                      {[r.area, r.genre].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <DistributionDisplay
                    dist={dist}
                    countLabel={countLabel}
                    emptyMessage={emptyMessage}
                  />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <BottomNav />
    </main>
  )
}
