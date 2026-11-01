import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import ReviewCard, { type ReviewCardData } from '@/components/ReviewCard'
import ReviewTabsNav, { type ReviewTab } from '@/components/ReviewTabsNav'
import ShareButton from '@/components/ShareButton'
import RestaurantProfileSection from '@/components/restaurants/RestaurantProfileSection'
import FoodKitMatchSection from '@/components/restaurants/FoodKitMatchSection'
import PhotoGallery, { type GalleryImage } from '@/components/restaurants/PhotoGallery'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import { getUserState } from '@/lib/auth/getUserState'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'
import { type RestaurantProfileRow } from '@/lib/restaurants/profile'
import { type FoodKitMatchRow, findMatchRow } from '@/lib/restaurants/match'
import { Suspense } from 'react'
import { RATING_LABELS, RATING_BAR } from '@/lib/rating/colors'

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
  main_image_uploaded_by: string | null
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

function RatingBar({ rating, percent }: { rating: number; percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[80px] shrink-0 text-xs text-ink">{RATING_LABELS[rating]}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-edge" style={{ height: '8px' }}>
        <div
          className={`h-full rounded-full ${RATING_BAR[rating]}`}
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

  const [restaurantResult, ratingCountsResult, reviewsResult, cardCountResult, reviewerCheckResult, profileResult, matchResult, allReviewImagesResult] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, source, external_place_id, area, genre, address, memo, budget_per_person_max_yen, main_image_path, created_by, main_image_uploaded_by')
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
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', id)
      .eq('user_id', user.id)
      .limit(1),
    supabase.rpc('get_restaurant_profiles', {
      p_restaurant_ids: [id],
    }),
    supabase.rpc('get_my_foodkit_matches', {
      p_restaurant_ids: [id],
    }),
    // All review image paths for this restaurant (newest first) — gallery only.
    // Limited to 50: Supabase PostgREST default max_rows=1000, but 50 is sufficient for a
    // mobile gallery and keeps signed-URL generation bounded.
    // Secondary sort by id ensures stable ordering when created_at values are equal.
    supabase
      .from('reviews')
      .select('image_path')
      .eq('restaurant_id', id)
      .not('image_path', 'is', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(50),
  ])

  if (restaurantResult.error) {
    throw new Error(`RestaurantDetailPage: query failed: ${restaurantResult.error.message}`)
  }
  if (!restaurantResult.data) notFound()

  if (reviewsResult.error) {
    throw new Error(`RestaurantDetailPage: RPC failed: ${reviewsResult.error.message}`)
  }

  if (profileResult.error) {
    console.error(`RestaurantDetailPage: get_restaurant_profiles failed: ${profileResult.error.message}`)
  }

  if (matchResult.error) {
    console.error(`RestaurantDetailPage: get_my_foodkit_matches failed: ${matchResult.error.message}`)
  }

  // Gallery image query failure is non-fatal: main photo + review cards still work.
  if (allReviewImagesResult.error) {
    console.error(`RestaurantDetailPage: review image fetch failed: ${allReviewImagesResult.error.message}`)
  }

  const hasUserReview = (reviewerCheckResult.count ?? 0) > 0
  const profileRows = (profileResult.data ?? []) as RestaurantProfileRow[]
  const matchRows = matchResult.error ? [] : (matchResult.data ?? []) as unknown as FoodKitMatchRow[]
  const matchRow = findMatchRow(matchRows, id)

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

  // Gallery image paths: only use allReviewImagesResult when the query succeeded.
  // On error, fall back to rpcRows paths so review cards are unaffected.
  const galleryReviewPaths: string[] = allReviewImagesResult.error
    ? []
    : [
        ...new Set(
          (allReviewImagesResult.data ?? [])
            .map((row) => row.image_path as string)
        ),
      ]

  // All unique review image paths for signed-URL generation:
  // gallery paths union preview card paths (rpcRows), both deduplicated.
  const allReviewImagePaths = [
    ...new Set([
      ...galleryReviewPaths,
      ...rpcRows.map((row) => row.image_path).filter((p): p is string => Boolean(p)),
    ]),
  ]
  const signedImagesResult = allReviewImagePaths.length
    ? await supabase.storage.from('review-images').createSignedUrls(allReviewImagePaths, 60 * 60)
    : { data: [], error: null }

  const signedImageUrls = new Map<string, string>()
  for (const item of signedImagesResult.data ?? []) {
    if (item.path && !item.error && item.signedUrl) signedImageUrls.set(item.path, item.signedUrl)
  }

  // Build gallery images: main photo first, then review photos (newest first).
  // seenKeys tracks "bucket:path" to prevent duplicates within each bucket source.
  let galleryImages: GalleryImage[] = []
  const seenKeys = new Set<string>()

  if (mainImageSignedUrl && r.main_image_path) {
    const key = `r:${r.main_image_path}`
    seenKeys.add(key)
    galleryImages.push({ key, url: mainImageSignedUrl, alt: rDisplay.name })
  }
  for (const path of galleryReviewPaths) {
    const key = `rv:${path}`
    if (seenKeys.has(key)) continue
    const url = signedImageUrls.get(path)
    if (url) {
      seenKeys.add(key)
      galleryImages.push({ key, url, alt: '記録写真' })
    }
  }

  // eTag + size deduplication across gallery images.
  // Handles: (a) same file in main + review buckets, (b) same file across multiple reviews.
  // Only runs when at least one review image is in the gallery.
  // Safe fallback: any photo whose info() fails or returns incomplete metadata is kept.
  const reviewPathsInGallery = galleryImages
    .filter((img) => img.key.startsWith('rv:'))
    .map((img) => img.key.slice(3))

  if (reviewPathsInGallery.length > 0) {
    try {
      // Track seen eTag:size combinations. Main image claims its key first (takes priority).
      const seenETagSizes = new Set<string>()

      if (r.main_image_path && mainImageSignedUrl) {
        const { data: mainInfo, error: mainInfoError } = await supabase.storage
          .from('restaurant-images')
          .info(r.main_image_path)
        const mainETag = !mainInfoError ? (mainInfo?.etag?.replace(/"/g, '') ?? null) : null
        const mainSize = !mainInfoError ? (mainInfo?.size ?? null) : null
        if (mainETag !== null && mainSize !== null) {
          seenETagSizes.add(`${mainETag}:${mainSize}`)
        }
      }

      // Fetch metadata for all review images in gallery, concurrency capped at 5 per batch.
      const CONCURRENCY = 5
      const reviewInfoMap = new Map<string, { etag: string; size: number } | null>()

      for (let i = 0; i < reviewPathsInGallery.length; i += CONCURRENCY) {
        const batch = reviewPathsInGallery.slice(i, i + CONCURRENCY)
        const batchResults = await Promise.all(
          batch.map((path) => supabase.storage.from('review-images').info(path))
        )
        for (let j = 0; j < batch.length; j++) {
          const { data: infoData, error: infoError } = batchResults[j]
          const etag = !infoError ? (infoData?.etag?.replace(/"/g, '') ?? null) : null
          const size = !infoError ? (infoData?.size ?? null) : null
          reviewInfoMap.set(batch[j], etag !== null && size !== null ? { etag, size } : null)
          // null → info() failed or incomplete → photo is kept (safe fallback)
        }
      }

      // Identify duplicate review paths: etag+size already claimed by an earlier image.
      const duplicateReviewPaths = new Set<string>()
      for (const path of reviewPathsInGallery) {
        const info = reviewInfoMap.get(path)
        if (!info) continue // missing info → keep
        const key = `${info.etag}:${info.size}`
        if (seenETagSizes.has(key)) {
          duplicateReviewPaths.add(path)
        } else {
          seenETagSizes.add(key) // first occurrence claims the key
        }
      }

      if (duplicateReviewPaths.size > 0) {
        galleryImages = galleryImages.filter((img) => {
          if (!img.key.startsWith('rv:')) return true
          return !duplicateReviewPaths.has(img.key.slice(3))
        })
      }
    } catch (err) {
      console.error('RestaurantDetailPage: gallery dedup failed:', err)
    }
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
  // Pencil: only manual restaurant owners can edit metadata
  const canEdit = isOwner && r.source !== 'google_place'
  // Camera: owner, current uploader, or reviewer adding the first photo
  const isUploader = r.main_image_uploaded_by !== null && r.main_image_uploaded_by === user.id
  const canEditImage =
    isOwner ||
    isUploader ||
    (r.main_image_path === null && hasUserReview)

  const viewerNeedsPreference = reviewTab === 'similar' && viewerCardCount < 5

  const emptyMessages: Record<ReviewTab, string> = {
    all: 'まだこのお店の記録はありません',
    similar: '好みが近い人の記録はまだありません',
    following: 'フォロー中の人の記録はまだありません',
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Photo gallery area */}
      <div className="relative w-full">
        <PhotoGallery images={galleryImages} restaurantName={rDisplay.name} />

        {/* Overlay — positioned over the main image zone (top 220px) only */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[220px]">
          {/* Add photo CTA — only when no photos at all */}
          {canEditImage && galleryImages.length === 0 && (
            <Link
              href={`/restaurants/${id}/image`}
              className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-2"
              aria-label="写真を追加"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <span className="text-sm font-bold text-white drop-shadow">写真を追加</span>
            </Link>
          )}

          {/* Nav / edit controls */}
          <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-14">
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
              {/* Camera: always show when eligible and any photo exists */}
              {canEditImage && galleryImages.length > 0 && (
                <Link
                  href={`/restaurants/${id}/image`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white"
                  aria-label="店舗の写真を編集"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </Link>
              )}
              <Suspense>
                <ShareButton title={rDisplay.name} url={pageUrl} />
              </Suspense>
            </div>
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

      {/* FoodKit Match Score */}
      <FoodKitMatchSection matchRow={matchRow} />

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

      {/* Restaurant profile — top labels from label votes */}
      <RestaurantProfileSection profileRows={profileRows} />

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
