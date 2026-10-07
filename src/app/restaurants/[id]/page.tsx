import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import ReviewCard, { type ReviewCardData } from '@/components/ReviewCard'
import ReviewTabsNav, { type ReviewTab } from '@/components/ReviewTabsNav'
import ShareButton from '@/components/ShareButton'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import { Suspense } from 'react'

const REVIEW_PREVIEW_COUNT = 3

type Restaurant = {
  id: string
  name: string
  area: string | null
  genre: string | null
  address: string | null
  memo: string | null
}

type RpcReviewRow = {
  review_id: string
  restaurant_id: string
  user_id: string
  username: string | null
  name: string | null
  avatar_path: string | null
  rating: number
  comment: string | null
  visit_date: string | null
  image_path: string | null
  created_at: string
}

function parseReviewTab(raw: string | undefined): ReviewTab {
  if (raw === 'similar' || raw === 'following') return raw
  return 'all'
}

function buildMapsUrl(restaurantName: string, address: string | null): string {
  const query = address ? `${restaurantName} ${address}` : restaurantName
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RestaurantDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const raw = await searchParams
  const reviewTab = parseReviewTab(
    Array.isArray(raw.reviewTab) ? raw.reviewTab[0] : raw.reviewTab,
  )

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/restaurants/[id]', Boolean(user))
  if (!user) redirect('/login')

  const { data: restaurantData, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, name, area, genre, address, memo')
    .eq('id', id)
    .maybeSingle()

  if (restaurantError) {
    throw new Error(`RestaurantDetailPage: query failed: ${restaurantError.message}`)
  }
  if (!restaurantData) notFound()

  const r = restaurantData as Restaurant

  // Viewer's preference card count (needed for similar tab empty state)
  const [reviewsResult, cardCountResult] = await Promise.all([
    supabase.rpc('get_restaurant_reviews_v2', {
      p_restaurant_id: id,
      p_scope: reviewTab,
      p_sort: 'newest',
      p_limit: REVIEW_PREVIEW_COUNT,
      p_offset: 0,
    }),
    supabase
      .from('user_preference_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  if (reviewsResult.error) {
    throw new Error(`RestaurantDetailPage: RPC failed: ${reviewsResult.error.message}`)
  }

  const rpcRows = (reviewsResult.data ?? []) as RpcReviewRow[]
  const viewerCardCount = cardCountResult.count ?? 0

  // Generate signed URLs for review images
  const imagePaths = [
    ...new Set(
      rpcRows.map((r) => r.image_path).filter((p): p is string => Boolean(p)),
    ),
  ]
  const signedImagesResult = imagePaths.length
    ? await supabase.storage.from('review-images').createSignedUrls(imagePaths, 60 * 60)
    : { data: [], error: null }

  const signedImageUrls = new Map<string, string>()
  for (const item of signedImagesResult.data ?? []) {
    if (item.path && !item.error && item.signedUrl) signedImageUrls.set(item.path, item.signedUrl)
  }

  // Avatar URLs (avatars bucket is public)
  const avatarPathsUniq = [
    ...new Set(rpcRows.map((r) => r.avatar_path).filter((p): p is string => Boolean(p))),
  ]
  const avatarUrlMap = new Map<string, string>()
  for (const path of avatarPathsUniq) {
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    avatarUrlMap.set(path, data.publicUrl)
  }

  const reviews: ReviewCardData[] = rpcRows.map((row) => ({
    review_id: row.review_id,
    restaurant_id: row.restaurant_id,
    user_id: row.user_id,
    username: row.username,
    name: row.name,
    avatar_path: row.avatar_path,
    avatar_url: row.avatar_path ? (avatarUrlMap.get(row.avatar_path) ?? null) : null,
    rating: row.rating,
    comment: row.comment,
    visit_date: row.visit_date,
    image_path: row.image_path,
    image_url: row.image_path ? (signedImageUrls.get(row.image_path) ?? null) : null,
    created_at: row.created_at,
  }))

  const mapsUrl = buildMapsUrl(r.name, r.address)
  const pageUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/restaurants/${id}`

  const viewerNeedsPreference = reviewTab === 'similar' && viewerCardCount < 5

  const emptyMessages: Record<ReviewTab, string> = {
    all: 'まだこのお店の記録はありません',
    similar: '好みが近い人の記録はまだありません',
    following: 'フォロー中の人の記録はまだありません',
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 pb-20">
      <div className="mx-auto max-w-md space-y-4">
        {/* Back */}
        <Link href="/restaurants" className="block text-sm text-ink-sub transition-colors hover:text-ink">
          ← 一覧に戻る
        </Link>

        {/* Restaurant info */}
        <section className="rounded-2xl border border-edge bg-surface p-5 shadow-sm">
          <h1 className="mb-3 text-xl font-bold text-ink">{r.name}</h1>

          {(r.area || r.genre || r.address || r.memo) && (
            <dl className="space-y-2 text-sm">
              {r.area && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 font-medium text-ink-sub">エリア</dt>
                  <dd className="text-ink">{r.area}</dd>
                </div>
              )}
              {r.genre && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 font-medium text-ink-sub">ジャンル</dt>
                  <dd className="text-ink">{r.genre}</dd>
                </div>
              )}
              {r.address && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 font-medium text-ink-sub">住所</dt>
                  <dd className="text-ink">{r.address}</dd>
                </div>
              )}
              {r.memo && (
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 font-medium text-ink-sub">メモ</dt>
                  <dd className="whitespace-pre-wrap text-ink">{r.memo}</dd>
                </div>
              )}
            </dl>
          )}

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/record/${id}`}
              className="flex items-center gap-1.5 rounded-full bg-terra px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-terra-deep"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              記録する
            </Link>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-edge bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-ink-sub">
                <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
              </svg>
              地図
            </a>

            <Suspense>
              <ShareButton title={r.name} url={pageUrl} />
            </Suspense>
          </div>
        </section>

        {/* Reviews section */}
        <section className="rounded-2xl border border-edge bg-surface shadow-sm">
          <div className="px-5 pt-5">
            <h2 className="text-base font-semibold text-ink">この店の記録</h2>
          </div>

          {/* Tab nav */}
          <div className="mt-3 px-5">
            <Suspense>
              <ReviewTabsNav activeTab={reviewTab} />
            </Suspense>
          </div>

          {/* Reviews list */}
          <div className="space-y-3 p-5">
            {viewerNeedsPreference ? (
              <div className="rounded-xl bg-canvas px-4 py-6 text-center">
                <p className="text-sm text-ink-sub">
                  好みを設定すると、あなたと食の好みが近い人の記録を表示できます。
                </p>
                <Link
                  href="/mypage/food-preferences/edit"
                  className="mt-3 inline-block rounded-full bg-terra px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-terra-deep"
                >
                  好みを設定する
                </Link>
              </div>
            ) : reviews.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-sub">{emptyMessages[reviewTab]}</p>
            ) : (
              <>
                {reviews.map((review) => (
                  <ReviewCard
                    key={review.review_id}
                    review={review}
                    currentUserId={user.id}
                    detailHref={`/records/${review.review_id}`}
                  />
                ))}

                <Link
                  href={`/restaurants/${id}/records?reviewTab=${reviewTab}`}
                  className="mt-1 block rounded-xl border border-edge bg-canvas px-4 py-3 text-center text-sm font-medium text-terra transition-colors hover:bg-surface"
                >
                  もっと見る →
                </Link>
              </>
            )}
          </div>
        </section>
      </div>
      <BottomNav />
    </main>
  )
}
