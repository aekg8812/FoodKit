import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import ReviewCard, { type ReviewCardData } from '@/components/ReviewCard'
import ReviewTabsNav, { type ReviewTab } from '@/components/ReviewTabsNav'
import ShareButton from '@/components/ShareButton'
import RestaurantMainImage from '@/components/RestaurantMainImage'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import { getUserState } from '@/lib/auth/getUserState'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'
import { Suspense } from 'react'

const REVIEW_PREVIEW_COUNT = 3

type Restaurant = {
  id: string
  name: string | null
  source: string
  external_place_id: string | null
  area: string | null
  genre: string | null
  address: string | null
  memo: string | null
  budget_per_person_max_yen: number | null
  main_image_path: string | null
  created_by: string | null
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

type RatingCounts = { rating: number; count: number }[]

function parseReviewTab(raw: string | undefined): ReviewTab {
  if (raw === 'similar' || raw === 'following') return raw
  return 'all'
}

function buildMapsUrl(restaurantName: string, address: string | null): string {
  const query = address ? `${restaurantName} ${address}` : restaurantName
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

const RATING_LABELS: Record<number, string> = {
  4: '常連になりたい',
  3: 'また行きたい',
  2: '一度で十分',
  1: '二度と行かない',
}

const RATING_COLORS: Record<number, string> = {
  4: 'bg-emerald-400',
  3: 'bg-terra',
  2: 'bg-sky-400',
  1: 'bg-zinc-300',
}

function RatingBar({ rating, percent }: { rating: number; percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[80px] shrink-0 text-xs text-ink">{RATING_LABELS[rating]}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-edge" style={{ height: '8px' }}>
        <div
          className={`h-full rounded-full ${RATING_COLORS[rating]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-[32px] shrink-0 text-right text-xs text-ink-sub">{percent}%</span>
    </div>
  )
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

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [restaurantResult, ratingCountsResult, reviewsResult, cardCountResult] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, source, external_place_id, area, genre, address, memo, budget_per_person_max_yen, main_image_path, created_by')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('reviews')
      .select('rating')
      .eq('restaurant_id', id),
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

  if (restaurantResult.error) {
    throw new Error(`RestaurantDetailPage: query failed: ${restaurantResult.error.message}`)
  }
  if (!restaurantResult.data) notFound()

  if (reviewsResult.error) {
    throw new Error(`RestaurantDetailPage: RPC failed: ${reviewsResult.error.message}`)
  }

  const r = restaurantResult.data as Restaurant
  const rDisplay = await resolveRestaurantDisplay(r)
  const rpcRows = (reviewsResult.data ?? []) as RpcReviewRow[]
  const viewerCardCount = cardCountResult.count ?? 0

  // Compute rating distribution
  const allRatings: number[] = (ratingCountsResult.data ?? []).map((row: { rating: number }) => row.rating)
  const totalReviews = allRatings.length
  const ratingCounts: Record<number, number> = { 4: 0, 3: 0, 2: 0, 1: 0 }
  for (const rating of allRatings) {
    if (rating >= 1 && rating <= 4) ratingCounts[rating]++
  }
  const ratingPercents: Record<number, number> = {
    4: totalReviews ? Math.round((ratingCounts[4] / totalReviews) * 100) : 0,
    3: totalReviews ? Math.round((ratingCounts[3] / totalReviews) * 100) : 0,
    2: totalReviews ? Math.round((ratingCounts[2] / totalReviews) * 100) : 0,
    1: totalReviews ? Math.round((ratingCounts[1] / totalReviews) * 100) : 0,
  }

  // Generate signed URL for restaurant main image (private bucket)
  let mainImageSignedUrl: string | null = null
  if (r.main_image_path) {
    const { data: signedData } = await supabase.storage
      .from('restaurant-images')
      .createSignedUrl(r.main_image_path, 60 * 60)
    mainImageSignedUrl = signedData?.signedUrl ?? null
  }

  // Generate signed URLs for review images
  const imagePaths = [
    ...new Set(rpcRows.map((row) => row.image_path).filter((p): p is string => Boolean(p))),
  ]
  const signedImagesResult = imagePaths.length
    ? await supabase.storage.from('review-images').createSignedUrls(imagePaths, 60 * 60)
    : { data: [], error: null }

  const signedImageUrls = new Map<string, string>()
  for (const item of signedImagesResult.data ?? []) {
    if (item.path && !item.error && item.signedUrl) signedImageUrls.set(item.path, item.signedUrl)
  }

  const avatarPathsUniq = [
    ...new Set(rpcRows.map((row) => row.avatar_path).filter((p): p is string => Boolean(p))),
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

  const displayAddress = rDisplay.address ?? r.address
  const mapsUrl = buildMapsUrl(rDisplay.name, displayAddress)
  const pageUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/restaurants/${id}`
    : undefined
  const isOwner = r.created_by !== null && r.created_by === user.id
  const canEdit = isOwner && r.source !== 'google_place'

  const viewerNeedsPreference = reviewTab === 'similar' && viewerCardCount < 5

  const emptyMessages: Record<ReviewTab, string> = {
    all: 'まだこのお店の記録はありません',
    similar: '好みが近い人の記録はまだありません',
    following: 'フォロー中の人の記録はまだありません',
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Hero image area */}
      <div className="relative h-[220px] w-full overflow-hidden">
        <RestaurantMainImage src={mainImageSignedUrl} alt={rDisplay.name} />

        {/* Overlay controls */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-14">
          <Suspense>
            <BackButton fallbackHref="/home" label="" />
          </Suspense>
          <div className="flex items-center gap-3">
            {canEdit && (
              <Link
                href={`/restaurants/${id}/edit`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white"
                aria-label="店舗情報を編集"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </Link>
            )}
            <Suspense>
              <ShareButton title={rDisplay.name} url={pageUrl} />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Restaurant name + meta */}
      <div className="bg-surface px-4 pt-4 pb-4">
        <h1 className="text-xl font-black text-ink" translate={rDisplay.isGoogle ? 'no' : undefined}>{rDisplay.name}</h1>
        {(r.area || r.genre) && (
          <p className="mt-0.5 text-sm text-ink-sub">{[r.genre, r.area].filter(Boolean).join('・')}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-sub">
          {r.budget_per_person_max_yen && (
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v12M9 9h4.5a2 2 0 0 1 0 4H9a2 2 0 0 0 0 4h5" />
              </svg>
              ¥{r.budget_per_person_max_yen.toLocaleString()}以下/人
            </span>
          )}
          {displayAddress && (
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z" />
              </svg>
              <span translate={rDisplay.isGoogle ? 'no' : undefined}>{displayAddress}</span>
            </span>
          )}
        </div>

        {/* Action bar */}
        <div className="mt-3 flex items-center gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-edge bg-canvas text-sm font-medium text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="10" r="3" />
              <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z" />
            </svg>
            地図
          </a>
          <button type="button" className="flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-edge bg-canvas text-sm font-medium text-ink">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            保存
          </button>
          <Link
            href={`/record/${id}`}
            className="flex h-[38px] flex-[2] items-center justify-center gap-1.5 rounded-xl bg-terra text-sm font-bold text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            記録する
          </Link>
        </div>
      </div>

      {/* Rating distribution */}
      {totalReviews > 0 && (
        <div className="mx-4 mt-4 rounded-2xl bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">この店の記録</h2>
            <span className="text-xs text-ink-sub">{totalReviews}人の記録</span>
          </div>
          <div className="space-y-2">
            <RatingBar rating={4} percent={ratingPercents[4]} />
            <RatingBar rating={3} percent={ratingPercents[3]} />
            <RatingBar rating={2} percent={ratingPercents[2]} />
            <RatingBar rating={1} percent={ratingPercents[1]} />
          </div>
        </div>
      )}

      {/* Reviews section */}
      <div className="mx-4 mt-4 overflow-hidden rounded-2xl bg-surface">
        {/* Tab nav */}
        <div className="border-b border-edge px-4 pt-4">
          <Suspense>
            <ReviewTabsNav activeTab={reviewTab} />
          </Suspense>
        </div>

        {/* Review list */}
        <div className="p-4">
          {viewerNeedsPreference ? (
            <div className="rounded-xl bg-canvas px-4 py-6 text-center">
              <p className="text-sm text-ink-sub">
                好みを設定すると、あなたと食の好みが近い人の記録を表示できます。
              </p>
              <Link
                href="/mypage/food-preferences/edit"
                className="mt-3 inline-block rounded-xl bg-terra px-5 py-2 text-sm font-bold text-white"
              >
                好みを設定する
              </Link>
            </div>
          ) : reviews.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-sub">{emptyMessages[reviewTab]}</p>
          ) : (
            <>
              <ul className="space-y-3">
                {reviews.map((review) => (
                  <li key={review.review_id}>
                    <ReviewCard
                      review={review}
                      currentUserId={user.id}
                      detailHref={`/records/${review.review_id}`}
                    />
                  </li>
                ))}
              </ul>

              <Link
                href={`/restaurants/${id}/records?reviewTab=${reviewTab}`}
                className="mt-3 flex items-center justify-between rounded-xl border border-edge bg-canvas px-4 py-3 text-sm"
              >
                <span className="font-medium text-ink">もっと見る</span>
                <span className="text-terra">›</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Store info */}
      {(r.area || r.genre || displayAddress || r.memo) && (
        <div className="mx-4 mt-4 rounded-2xl bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold text-ink">店舗情報</h2>
          <dl className="space-y-2.5">
            {r.genre && (
              <div className="flex gap-3 text-sm">
                <dt className="flex w-[64px] shrink-0 items-center gap-1.5 text-ink-sub">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  ジャンル
                </dt>
                <dd className="text-ink">{r.genre}</dd>
              </div>
            )}
            {r.budget_per_person_max_yen && (
              <div className="flex gap-3 text-sm">
                <dt className="flex w-[64px] shrink-0 items-center gap-1.5 text-ink-sub">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v12M9 9h4.5a2 2 0 0 1 0 4H9a2 2 0 0 0 0 4h5" />
                  </svg>
                  予算
                </dt>
                <dd className="text-ink">¥{r.budget_per_person_max_yen.toLocaleString()}以下/人</dd>
              </div>
            )}
            {displayAddress && (
              <div className="flex gap-3 text-sm">
                <dt className="flex w-[64px] shrink-0 items-center gap-1.5 text-ink-sub">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="10" r="3" />
                    <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z" />
                  </svg>
                  住所
                </dt>
                <dd className="text-ink" translate={rDisplay.isGoogle ? 'no' : undefined}>{displayAddress}</dd>
              </div>
            )}
            {r.area && (
              <div className="flex gap-3 text-sm">
                <dt className="flex w-[64px] shrink-0 items-center gap-1.5 text-ink-sub">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  エリア
                </dt>
                <dd className="text-ink">{r.area}</dd>
              </div>
            )}
            {r.memo && (
              <div className="flex gap-3 text-sm">
                <dt className="w-[64px] shrink-0 text-ink-sub">メモ</dt>
                <dd className="whitespace-pre-wrap text-ink">{r.memo}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <BottomNav />
    </main>
  )
}
