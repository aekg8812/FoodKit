import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import ReviewForm, { type ExistingReview, RATING_LABELS } from './ReviewForm'

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
      .select('group_id')
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
  const groupId = accessResult.data?.group_id as string | undefined
  const existingReview = existingReviewResult.data as ExistingReview | null

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-md">
        <Link href="/restaurants" className="mb-4 block text-sm text-zinc-500 hover:text-zinc-700">
          ← 一覧に戻る
        </Link>

        <section className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="mb-4 text-2xl font-semibold text-zinc-950">{r.name}</h1>

          {(r.area || r.genre || r.address || r.memo) && (
            <dl className="space-y-3 text-sm">
              {r.area && (
                <div>
                  <dt className="font-medium text-zinc-500">エリア</dt>
                  <dd className="mt-0.5 text-zinc-950">{r.area}</dd>
                </div>
              )}
              {r.genre && (
                <div>
                  <dt className="font-medium text-zinc-500">ジャンル</dt>
                  <dd className="mt-0.5 text-zinc-950">{r.genre}</dd>
                </div>
              )}
              {r.address && (
                <div>
                  <dt className="font-medium text-zinc-500">住所</dt>
                  <dd className="mt-0.5 text-zinc-950">{r.address}</dd>
                </div>
              )}
              {r.memo && (
                <div>
                  <dt className="font-medium text-zinc-500">メモ</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-zinc-950">{r.memo}</dd>
                </div>
              )}
            </dl>
          )}
        </section>

        <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-zinc-950">
            {existingReview ? 'あなたの評価を更新' : 'レビューを投稿'}
          </h2>
          {groupId ? (
            <ReviewForm
              key={existingReview?.id ?? 'new'}
              restaurantId={id}
              groupId={groupId}
              existingReview={existingReview}
            />
          ) : (
            <p className="text-sm text-zinc-500">
              レビュー投稿ができません（グループへの共有情報が見つかりません）
            </p>
          )}
        </section>

        <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-zinc-950">レビュー一覧</h2>

          {reviews.length === 0 ? (
            <p className="text-sm text-zinc-500">まだレビューがありません</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {reviews.map((review) => (
                <li key={review.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {review.user_id === user.id && (
                        <span className="mb-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                          あなたの評価
                        </span>
                      )}
                      <p className="font-medium text-zinc-950">
                        {review.rating}&nbsp;
                        <span className="font-normal">{RATING_LABELS[review.rating]}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-500">
                        {review.users?.name ?? '不明'}
                      </p>
                    </div>
                    {review.visit_date && (
                      <p className="shrink-0 text-xs text-zinc-400">{review.visit_date}</p>
                    )}
                  </div>
                  {review.comment && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">
                      {review.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
