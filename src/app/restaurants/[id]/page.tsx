import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import ReviewForm, { type ExistingReview } from './ReviewForm'
import BottomNav from '@/components/BottomNav'
import RatingBadge, { RATING_LABELS } from '@/components/RatingBadge'

type Restaurant = {
  id: string
  name: string
  area: string | null
  genre: string | null
  address: string | null
  memo: string | null
}

type ReviewWithUser = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  created_at: string
  user_id: string
  users: { name: string } | null
}

type GroupAccess = {
  group_id: string
  groups: { name: string } | { name: string }[] | null
}

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, area, genre, address, memo')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`RestaurantDetailPage: query failed: ${error.message}`)
  }

  // RLS filters out restaurants the user cannot see (no permission or does not exist).
  // Both cases are treated as 404 — distinguishing them would leak information.
  if (!data) notFound()

  const r = data as Restaurant

  const [reviewsResult, accessResult, existingReviewResult] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, rating, comment, visit_date, created_at, user_id, users(name)')
      .eq('restaurant_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('restaurant_accesses')
      .select('group_id, groups(name)')
      .eq('restaurant_id', id)
      .eq('visibility', 'group')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('reviews')
      .select('id, rating, comment, visit_date')
      .eq('restaurant_id', id)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle(),
  ])

  if (reviewsResult.error) {
    throw new Error(
      `RestaurantDetailPage: failed to load reviews: ${reviewsResult.error.message}`,
    )
  }
  if (accessResult.error) {
    throw new Error(
      `RestaurantDetailPage: failed to load restaurant access: ${accessResult.error.message}`,
    )
  }
  if (existingReviewResult.error) {
    throw new Error(
      `RestaurantDetailPage: failed to load existing review: ${existingReviewResult.error.message}`,
    )
  }

  const reviews = (reviewsResult.data ?? []) as unknown as ReviewWithUser[]
  const groupAccess = accessResult.data as unknown as GroupAccess | null
  const groupId = groupAccess?.group_id
  const accessGroups = groupAccess?.groups
  const groupName = (
    Array.isArray(accessGroups) ? accessGroups[0]?.name : accessGroups?.name
  ) ?? '現在のグループ'
  const existingReview = existingReviewResult.data as ExistingReview | null

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <div className="mx-auto max-w-md">
        <Link href="/restaurants" className="mb-5 block text-sm text-ink-sub transition-colors duration-150 hover:text-ink">
          ← 一覧に戻る
        </Link>

        {/* 店舗情報 */}
        <section className="rounded-2xl border border-edge bg-surface p-6 shadow-sm">
          <h1 className="mb-4 text-2xl font-bold text-ink">{r.name}</h1>

          {(r.area || r.genre || r.address || r.memo) && (
            <dl className="space-y-3 text-sm">
              {r.area && (
                <div>
                  <dt className="font-medium text-ink-sub">エリア</dt>
                  <dd className="mt-0.5 text-ink">{r.area}</dd>
                </div>
              )}
              {r.genre && (
                <div>
                  <dt className="font-medium text-ink-sub">ジャンル</dt>
                  <dd className="mt-0.5 text-ink">{r.genre}</dd>
                </div>
              )}
              {r.address && (
                <div>
                  <dt className="font-medium text-ink-sub">住所</dt>
                  <dd className="mt-0.5 text-ink">{r.address}</dd>
                </div>
              )}
              {r.memo && (
                <div>
                  <dt className="font-medium text-ink-sub">メモ</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-ink">{r.memo}</dd>
                </div>
              )}
            </dl>
          )}
        </section>

        {/* レビュー投稿フォーム */}
        <section className="mt-4 rounded-2xl border border-edge bg-surface p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">
              {existingReview ? 'あなたの評価を更新' : 'レビューを投稿'}
            </h2>
            {/* レビュー管理導線: 削除などの管理操作は履歴ページに集約する */}
            {existingReview && (
              <Link
                href="/mypage/reviews"
                className="shrink-0 text-sm font-medium text-terra transition-colors hover:text-terra-deep"
              >
                レビューを管理する
              </Link>
            )}
          </div>
          {groupId ? (
            <ReviewForm
              key={existingReview?.id ?? 'new'}
              restaurantId={id}
              groupId={groupId}
              groupName={groupName}
              existingReview={existingReview}
            />
          ) : (
            <p className="text-sm text-ink-sub">
              レビュー投稿ができません（グループへの共有情報が見つかりません）
            </p>
          )}
        </section>

        {/* レビュー一覧 */}
        <section className="mt-4 rounded-2xl border border-edge bg-surface p-6 shadow-sm">
          <h2 className="mb-5 text-base font-semibold text-ink">みんなの評価</h2>

          {reviews.length === 0 ? (
            <div className="py-2 text-center">
              <p className="mb-1.5 text-2xl" aria-hidden="true">✍️</p>
              <p className="text-sm text-ink-sub">まだレビューがありません</p>
            </div>
          ) : (
            <ul className="divide-y divide-edge">
              {reviews.map((review) => (
                <li key={review.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {review.user_id === user.id && (
                        <span className="mb-2 inline-block rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-amber-800">
                          あなたの評価
                        </span>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <RatingBadge rating={review.rating} />
                        <span className="text-sm text-ink">{RATING_LABELS[review.rating]}</span>
                      </div>
                      <p className="mt-1 text-sm text-ink-sub">
                        {review.users?.name ?? '不明'}
                      </p>
                    </div>
                    {review.visit_date && (
                      <p className="shrink-0 text-xs text-ink-sub">{review.visit_date}</p>
                    )}
                  </div>
                  {review.comment && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink-sub">
                      {review.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <BottomNav />
    </main>
  )
}
