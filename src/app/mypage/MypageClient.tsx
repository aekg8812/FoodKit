'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import LogoutButton from '@/components/LogoutButton'
import BottomNav from '@/components/BottomNav'
import Card from '@/components/ui/Card'
import RatingBadge, { RATING_LABELS } from '@/components/RatingBadge'
import ValueTypeBadge from '@/components/ValueTypeBadge'

export type UserRow = { name: string; email: string }

export type ValueProfileRow = {
  main_value_type: string | null
  // PostgreSQL numeric(4,3) may arrive as string from the Supabase client.
  confidence: number | string
  profile_completion: number
}

export type MyReviewRow = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  created_at: string
  restaurant_id: string
  // reviews.restaurant_id → restaurants.id (FK on reviews → outbound join → single object)
  restaurants: { id: string; name: string } | null
}

export type MyRestaurantRow = {
  id: string
  name: string
  area: string | null
  genre: string | null
  created_at: string
}

export type GroupRow = { id: string; name: string; invite_code: string }

interface Props {
  userData: UserRow
  profile: ValueProfileRow | null
  myReviews: MyReviewRow[]
  myRestaurants: MyRestaurantRow[]
  group: GroupRow | null
}

export default function MypageClient({ userData, profile, myReviews, myRestaurants, group }: Props) {
  // numeric(4,3) may arrive as string "0.400" — Number() handles both
  const confidencePct = useMemo(
    () => (profile ? Math.round(Number(profile.confidence) * 100) : null),
    [profile],
  )

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-2xl font-bold text-ink">マイページ</h1>

        <div className="space-y-4">
          {/* 価値観プロファイル */}
          <Card as="section" className="p-6">
            <h2 className="mb-5 text-base font-semibold text-ink">価値観プロファイル</h2>
            {profile ? (
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-xs font-medium text-ink-sub">タイプ</p>
                  <ValueTypeBadge type={profile.main_value_type} />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-medium text-ink-sub">診断精度</p>
                    <p className="text-xs tabular-nums text-ink-sub">{confidencePct}%</p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
                    <div
                      className="h-2 rounded-full bg-terra"
                      style={{ width: `${confidencePct}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-medium text-ink-sub">プロフィール完成度</p>
                    <p className="text-xs tabular-nums text-ink-sub">{profile.profile_completion}%</p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
                    <div
                      className="h-2 rounded-full bg-honey"
                      style={{ width: `${profile.profile_completion}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-sub">価値観診断が未完了です</p>
            )}
          </Card>

          {/* 投稿したレビュー */}
          <Card as="section" className="p-6">
            <h2 className="mb-4 text-base font-semibold text-ink">投稿したレビュー</h2>
            {myReviews.length === 0 ? (
              <div className="py-2 text-center">
                <p className="mb-1.5 text-2xl" aria-hidden="true">📝</p>
                <p className="text-sm text-ink-sub">まだレビューを投稿していません</p>
              </div>
            ) : (
              <ul className="divide-y divide-edge">
                {myReviews.map((review) => (
                  <li key={review.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      href={`/restaurants/${review.restaurant_id}`}
                      className="block transition-opacity duration-150 hover:opacity-70"
                    >
                      <p className="font-medium text-ink">
                        {review.restaurants?.name ?? '（店舗情報なし）'}
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                        <RatingBadge rating={review.rating} />
                        <span className="text-ink-sub">{RATING_LABELS[review.rating]}</span>
                      </p>
                      {review.comment && (
                        <p className="mt-1.5 line-clamp-2 text-sm text-ink-sub">
                          {review.comment}
                        </p>
                      )}
                      {review.visit_date && (
                        <p className="mt-1 text-xs text-ink-sub">{review.visit_date}</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* 登録した店舗 */}
          <Card as="section" className="p-6">
            <h2 className="mb-4 text-base font-semibold text-ink">登録した店舗</h2>
            {myRestaurants.length === 0 ? (
              <div className="py-2 text-center">
                <p className="mb-1.5 text-2xl" aria-hidden="true">🍽️</p>
                <p className="mb-4 text-sm text-ink-sub">まだ店舗を登録していません</p>
                <Link
                  href="/restaurants/new"
                  className="inline-block rounded-full bg-terra px-5 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-terra-deep motion-safe:active:scale-[0.98]"
                >
                  店舗を登録
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-edge">
                {myRestaurants.map((r) => (
                  <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <Link
                      href={`/restaurants/${r.id}`}
                      className="block transition-opacity duration-150 hover:opacity-70"
                    >
                      <p className="font-medium text-ink">{r.name}</p>
                      {(r.area || r.genre) && (
                        <p className="mt-0.5 text-sm text-ink-sub">
                          {[r.area, r.genre].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* 所属グループ */}
          <Card as="section" className="p-6">
            <h2 className="mb-2 text-base font-semibold text-ink">所属グループ</h2>
            {group ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink">{group.name}</p>
                <Link
                  href="/groups"
                  className="shrink-0 text-sm text-terra transition-colors duration-150 hover:text-terra-deep"
                >
                  グループを見る →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-ink-sub">グループ情報が見つかりません</p>
            )}
          </Card>

          {/* アカウント */}
          <Card as="section" className="p-6">
            <h2 className="mb-4 text-base font-semibold text-ink">アカウント</h2>
            <dl className="mb-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-ink-sub">名前</dt>
                <dd className="text-right text-ink">{userData.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-ink-sub">メール</dt>
                <dd className="truncate text-right text-ink">{userData.email}</dd>
              </div>
            </dl>
            <LogoutButton />
          </Card>
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
