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
  type RestaurantWithDist,
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

const INITIAL_UNREVIEWED_COUNT = 6
const INITIAL_REVIEWED_COUNT = 5

export default function RestaurantListClient({
  restaurants,
  reviews,
  profiles,
  currentUserId,
}: Props) {
  const profileMap = useMemo(() => buildProfileMap(profiles), [profiles])

  const myValueType = (profileMap.get(currentUserId) ?? null) as MainValueType | null

  const [filter, setFilter] = useState<FilterType>(myValueType ?? 'all')
  const [showAllReviewed, setShowAllReviewed] = useState(false)
  const [showUnreviewed, setShowUnreviewed] = useState(false)
  const [showAllUnreviewed, setShowAllUnreviewed] = useState(false)

  const sortedRestaurants = useMemo(() => {
    const eligibleUserIds = buildEligibleUserIds(profileMap, filter === 'all' ? null : filter)
    return sortRestaurants(restaurants, reviews, eligibleUserIds)
  }, [restaurants, reviews, profileMap, filter])

  const countLabel = filter === 'all' ? '全員' : VALUE_TYPE_LABEL[filter as MainValueType]
  const emptyMessage =
    filter === 'all'
      ? 'まだ評価がありません'
      : `${VALUE_TYPE_LABEL[filter as MainValueType]}の評価はまだありません`

  // 「レビューあり／なし」も現在の価値観フィルターを基準にする。
  // 例: 味重視だけのレビューは、コスパ重視ではレビューなしとして扱う。
  const reviewedRestaurants = sortedRestaurants.filter(({ dist }) => dist.total > 0)
  const unreviewedRestaurants = sortedRestaurants.filter(({ dist }) => dist.total === 0)
  const visibleReviewedRestaurants = showAllReviewed
    ? reviewedRestaurants
    : reviewedRestaurants.slice(0, INITIAL_REVIEWED_COUNT)
  const visibleUnreviewedRestaurants = showAllUnreviewed
    ? unreviewedRestaurants
    : unreviewedRestaurants.slice(0, INITIAL_UNREVIEWED_COUNT)

  function renderRestaurant({ restaurant: r, dist }: RestaurantWithDist) {
    return (
      <li key={r.id}>
        <Link href={`/restaurants/${r.id}`} prefetch={false} className="block">
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
    )
  }

  const pageHeader = (
    <div className="mb-5 flex items-center justify-between">
      <h1 className="text-2xl font-bold text-ink">店舗一覧</h1>
      <Link
        href="/restaurants/search"
        className="inline-flex min-h-[44px] items-center rounded-full bg-terra px-4 text-sm font-medium text-white transition-all duration-150 hover:bg-terra-deep motion-safe:active:scale-[0.98]"
      >
        ＋ 店舗を追加
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
              href="/restaurants/search"
              className="inline-flex min-h-[44px] items-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-all duration-150 hover:bg-terra-deep motion-safe:active:scale-[0.98]"
            >
              店舗を探す・追加する
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
              onClick={() => {
                setFilter(opt.value)
                setShowAllReviewed(false)
                setShowAllUnreviewed(false)
              }}
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

        {unreviewedRestaurants.length > 0 && (
          <label
            htmlFor="show-unreviewed-restaurants"
            className="mb-6 inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-ink-sub"
          >
            <input
              id="show-unreviewed-restaurants"
              type="checkbox"
              checked={showUnreviewed}
              onChange={(event) => {
                setShowUnreviewed(event.target.checked)
                if (!event.target.checked) setShowAllUnreviewed(false)
              }}
              className="h-4 w-4 rounded border-edge accent-terra"
            />
            <span>
              {filter === 'all'
                ? 'レビューがない店舗も表示'
                : `${VALUE_TYPE_LABEL[filter]}のレビューがない店舗も表示`}
              （{unreviewedRestaurants.length}件）
            </span>
          </label>
        )}

        {reviewedRestaurants.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">
                {filter === 'all'
                  ? 'レビューがある店舗'
                  : `${VALUE_TYPE_LABEL[filter]}のレビューがある店舗`}
              </h2>
              <span className="text-sm tabular-nums text-ink-sub">
                {reviewedRestaurants.length}件
              </span>
            </div>
            <ul className="space-y-3">{visibleReviewedRestaurants.map(renderRestaurant)}</ul>
            {reviewedRestaurants.length > INITIAL_REVIEWED_COUNT && (
              <button
                type="button"
                onClick={() => setShowAllReviewed((current) => !current)}
                className="mt-4 min-h-[44px] w-full text-sm font-medium text-ink-sub transition-colors hover:text-ink"
              >
                {showAllReviewed
                  ? '5件表示に戻す'
                  : `残り${reviewedRestaurants.length - INITIAL_REVIEWED_COUNT}件を表示`}
              </button>
            )}
          </section>
        )}

        {unreviewedRestaurants.length > 0 && showUnreviewed && (
          <section className={reviewedRestaurants.length > 0 ? 'mt-8' : ''}>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">
                  {filter === 'all'
                    ? 'まだレビューがない店舗'
                    : `${VALUE_TYPE_LABEL[filter]}のレビューがない店舗`}
                </h2>
                <p className="mt-1 text-xs text-ink-sub">最初のレビューを書いてみませんか？</p>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-ink-sub">
                {unreviewedRestaurants.length}件
              </span>
            </div>
            <ul className="space-y-3">
              {visibleUnreviewedRestaurants.map(renderRestaurant)}
            </ul>

            {unreviewedRestaurants.length > INITIAL_UNREVIEWED_COUNT && (
              <button
                type="button"
                onClick={() => setShowAllUnreviewed((current) => !current)}
                className="mt-4 min-h-[44px] w-full text-sm font-medium text-ink-sub transition-colors hover:text-ink"
              >
                {showAllUnreviewed
                  ? '6件表示に戻す'
                  : `残り${unreviewedRestaurants.length - INITIAL_UNREVIEWED_COUNT}件を表示`}
              </button>
            )}
          </section>
        )}
      </div>
      <BottomNav />
    </main>
  )
}
