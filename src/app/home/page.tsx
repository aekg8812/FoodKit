import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'
import {
  RATING_BG,
  RATING_TEXT,
  RATING_BORDER,
  RATING_LABELS,
} from '@/lib/rating/colors'
import RatingBadgeIcon from '@/app/logbook/RatingBadgeIcon'

// ── Types ──────────────────────────────────────────────────────────────────

type HomeStats = {
  this_month_count: number
  again_count: number
  new_places_count: number
}

type FolloweeRow = { followee_id: string }
type ReviewRow = {
  id: string
  restaurant_id: string
  rating: number
  comment: string | null
  image_path: string | null
  user_id: string
}
type RestaurantRow = {
  id: string
  name: string | null
  source: string
  external_place_id: string | null
  area: string | null
  genre: string | null
  main_image_path: string | null
}
type ProfileRow = { id: string; username: string; name: string | null }

const LABEL_LABEL: Record<string, string> = {
  solo: 'ひとり向き',
  friends: '友達向き',
  date: 'デート向き',
  large_group: '大人数向き',
  calm: '落ち着く',
  lively: 'にぎやか',
  stylish: 'おしゃれ',
  casual: 'カジュアル',
  quick: 'サクッと利用',
  long_stay: '長居しやすい',
  hearty: 'がっつり',
  photogenic: '写真映え',
}

const REASON_LABEL: Record<string, string> = {
  taste: '味',
  value: 'コスパ',
  atmosphere: '雰囲気',
  service: '接客',
  volume: 'ボリューム',
  access: 'アクセス',
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // ── Parallel fetches ──────────────────────────────────────────────────
  const [statsResult, followeeResult] = await Promise.all([
    supabase.rpc('get_home_stats'),
    supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', user.id)
      .eq('status', 'accepted'),
  ])

  const rawStats = (statsResult.data as unknown as HomeStats[] | null)?.[0]
  const statsError = statsResult.error
  const stats: HomeStats = {
    this_month_count: Number(rawStats?.this_month_count ?? 0),
    again_count: Number(rawStats?.again_count ?? 0),
    new_places_count: Number(rawStats?.new_places_count ?? 0),
  }

  const followeeIds = ((followeeResult.data ?? []) as FolloweeRow[]).map(
    (f) => f.followee_id,
  )

  // ── Reviews from followees ────────────────────────────────────────────
  const { data: reviewData } = followeeIds.length > 0
    ? await supabase
        .from('reviews')
        .select('id, restaurant_id, rating, comment, image_path, user_id')
        .in('user_id', followeeIds)
        .order('created_at', { ascending: false })
        .limit(3)
    : { data: [] as ReviewRow[] }

  const reviews = (reviewData ?? []) as ReviewRow[]

  // ── Restaurant + profile data ─────────────────────────────────────────
  const reviewRestaurantIds = [...new Set(reviews.map((r) => r.restaurant_id))]
  const reviewAuthorIds = [...new Set(reviews.map((r) => r.user_id))]

  const [restaurantsResult, profilesResult] = await Promise.all([
    reviewRestaurantIds.length > 0
      ? supabase
          .from('restaurants')
          .select('id, name, source, external_place_id, area, genre, main_image_path')
          .in('id', reviewRestaurantIds)
      : { data: [] as RestaurantRow[] },
    reviewAuthorIds.length > 0
      ? supabase
          .from('user_public_profiles')
          .select('id, username, name')
          .in('id', reviewAuthorIds)
      : { data: [] as ProfileRow[] },
  ])

  const restaurantMap = new Map(
    ((restaurantsResult.data ?? []) as RestaurantRow[]).map((r) => [r.id, r]),
  )
  const profileMap = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  )

  // ── Tags ──────────────────────────────────────────────────────────────
  const reviewIds = reviews.map((r) => r.id)
  const [reasonTagsResult, labelTagsResult] = reviewIds.length > 0
    ? await Promise.all([
        supabase
          .from('review_reason_tags')
          .select('review_id, reason_key')
          .in('review_id', reviewIds),
        supabase
          .from('review_restaurant_labels')
          .select('review_id, label_key')
          .in('review_id', reviewIds),
      ])
    : [{ data: [] }, { data: [] }]

  const reasonTagMap = new Map<string, string[]>()
  for (const t of (reasonTagsResult.data ?? []) as { review_id: string; reason_key: string }[]) {
    const arr = reasonTagMap.get(t.review_id) ?? []
    arr.push(t.reason_key)
    reasonTagMap.set(t.review_id, arr)
  }
  const labelTagMap = new Map<string, string[]>()
  for (const t of (labelTagsResult.data ?? []) as { review_id: string; label_key: string }[]) {
    const arr = labelTagMap.get(t.review_id) ?? []
    arr.push(t.label_key)
    labelTagMap.set(t.review_id, arr)
  }

  // ── Sign image URLs ───────────────────────────────────────────────────
  const reviewImagePaths = reviews.flatMap((r) => r.image_path ? [r.image_path] : [])
  const restaurantImagePaths = [
    ...new Set(
      [...restaurantMap.values()]
        .map((r) => r.main_image_path)
        .filter((p): p is string => Boolean(p)),
    ),
  ]

  const [signedReviews, signedRestaurants] = await Promise.all([
    reviewImagePaths.length > 0
      ? supabase.storage.from('review-images').createSignedUrls(reviewImagePaths, 3600)
      : { data: [] },
    restaurantImagePaths.length > 0
      ? supabase.storage.from('restaurant-images').createSignedUrls(restaurantImagePaths, 3600)
      : { data: [] },
  ])

  const signedReviewMap = new Map<string, string>()
  for (const s of signedReviews.data ?? []) {
    if (s.path && s.signedUrl && !s.error) signedReviewMap.set(s.path, s.signedUrl)
  }
  const signedRestaurantMap = new Map<string, string>()
  for (const s of signedRestaurants.data ?? []) {
    if (s.path && s.signedUrl && !s.error) signedRestaurantMap.set(s.path, s.signedUrl)
  }

  // ── Resolve display names for Google-sourced restaurants ─────────────
  const displayNameMap = new Map<string, string>()
  await Promise.all(
    [...restaurantMap.values()]
      .filter((r) => r.source === 'google_place' && r.external_place_id)
      .map(async (r) => {
        const d = await resolveRestaurantDisplay(r)
        displayNameMap.set(r.id, d.name)
      }),
  )

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <main className="min-h-dvh bg-canvas pb-24">
      <div className="mx-auto max-w-md px-4">

        {/* ── Page title ───────────────────────────────────────────────── */}
        <h1 className="pb-4 pt-6 text-center text-[20px] font-extrabold leading-tight text-ink">
          ホーム
        </h1>

        {/* ── Hero card ────────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: 24,
            background: 'linear-gradient(140deg, #FFE9CE 0%, #FFF3E4 50%, #FFF7EE 100%)',
            minHeight: 172,
            boxShadow: '0 2px 10px rgba(98,55,31,0.07)',
          }}
        >
          {/* ── Wave decoration — right side, organic curves ─────────── */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 343 172"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outermost wave */}
            <path
              d="M343,172 L160,172 Q200,120 250,80 Q290,50 343,10 Z"
              fill="#F4B96A"
              fillOpacity="0.20"
            />
            {/* Middle wave */}
            <path
              d="M343,172 L210,172 Q245,135 278,108 Q308,85 343,45 Z"
              fill="#F4A84E"
              fillOpacity="0.17"
            />
            {/* Inner wave */}
            <path
              d="M343,172 L258,172 Q280,150 300,132 Q320,115 343,88 Z"
              fill="#F4993A"
              fillOpacity="0.14"
            />
          </svg>

          {/* Sparkle — top right */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute top-5 right-6"
            width="26"
            height="26"
            viewBox="0 0 26 26"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <line x1="13" y1="1" x2="13" y2="9"  stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />
            <line x1="20" y1="4" x2="17" y2="10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.38" />
            <line x1="6"  y1="4" x2="9"  y2="10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.38" />
          </svg>

          {/* Content */}
          <div className="relative z-10 p-5">
            <h2
              className="font-extrabold leading-snug text-ink"
              style={{ fontSize: 25 }}
            >
              今日のごはんを<br />記録しよう
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-sub">
              お店や食事の記録を残して、<br />あとで見返せます
            </p>
            <Link
              href="/record"
              className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-terra px-6 text-[15px] font-bold text-white active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra focus-visible:ring-offset-2"
              style={{
                minWidth: 158,
                boxShadow: '0 2px 8px rgba(249,115,22,0.32)',
              }}
            >
              {/* Pencil icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              記録する
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </div>
        </div>

        {/* ── Stats cards — 3 columns ───────────────────────────────────── */}
        {/*
          Explicit inline grid to guarantee 3-column layout regardless of
          CSS cascade order in Tailwind v4.
        */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginTop: 12,
          }}
        >
          {/* 今月の記録 */}
          <div
            className="flex flex-col border border-edge bg-surface"
            style={{ borderRadius: 16, padding: '10px 10px 12px', boxShadow: '0 1px 6px rgba(98,55,31,0.05)' }}
          >
            {/* Calendar icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8"  y1="2" x2="8"  y2="6" />
              <line x1="3"  y1="10" x2="21" y2="10" />
            </svg>
            <p className="mt-1.5 text-[11px] font-semibold leading-snug text-ink-sub">
              今月の記録
            </p>
            {statsError ? (
              <p className="mt-1 text-[11px] text-ink-sub/60">—</p>
            ) : (
              <p className="mt-1 text-[26px] font-extrabold leading-none tabular-nums text-ink">
                {stats.this_month_count}
                <span className="ml-0.5 text-[12px] font-semibold">件</span>
              </p>
            )}
          </div>

          {/* また行きたい */}
          <div
            className="flex flex-col border border-edge bg-surface"
            style={{ borderRadius: 16, padding: '10px 10px 12px', boxShadow: '0 1px 6px rgba(98,55,31,0.05)' }}
          >
            {/* Heart icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <p className="mt-1.5 text-[11px] font-semibold leading-snug text-ink-sub">
              また行きたい
            </p>
            {statsError ? (
              <p className="mt-1 text-[11px] text-ink-sub/60">—</p>
            ) : (
              <p className="mt-1 text-[26px] font-extrabold leading-none tabular-nums text-ink">
                {stats.again_count}
                <span className="ml-0.5 text-[12px] font-semibold">件</span>
              </p>
            )}
          </div>

          {/* 新しく行った店 */}
          <div
            className="flex flex-col border border-edge bg-surface"
            style={{ borderRadius: 16, padding: '10px 10px 12px', boxShadow: '0 1px 6px rgba(98,55,31,0.05)' }}
          >
            {/* Pin icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <p className="mt-1.5 text-[11px] font-semibold leading-snug text-ink-sub">
              新しく行った店
            </p>
            {statsError ? (
              <p className="mt-1 text-[11px] text-ink-sub/60">—</p>
            ) : (
              <p className="mt-1 text-[26px] font-extrabold leading-none tabular-nums text-ink">
                {stats.new_places_count}
                <span className="ml-0.5 text-[12px] font-semibold">件</span>
              </p>
            )}
          </div>
        </div>

        {/* ── Feed section ─────────────────────────────────────────────── */}
        <section className="mt-5" aria-labelledby="feed-heading">

          {/* Section header */}
          <div className="mb-3 flex items-center gap-1.5">
            {/* Users icon */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F97316"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <h2
              id="feed-heading"
              className="flex-1 text-[18px] font-extrabold text-terra"
            >
              みんなの最近の記録
            </h2>
            {reviews.length > 0 && (
              <Link
                href="/home/following-records"
                className="shrink-0 text-[12px] font-semibold text-ink-sub"
              >
                すべて見る &rsaquo;
              </Link>
            )}
          </div>

          {/* Feed cards */}
          {reviews.length === 0 ? (
            <div
              className="border border-edge bg-surface px-5 py-8 text-center"
              style={{ borderRadius: 18 }}
            >
              {followeeIds.length === 0 ? (
                <>
                  <p className="text-[14px] font-semibold text-ink">
                    みんなの記録は準備中です
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-sub">
                    フォローするユーザーを追加すると、<br />
                    ここに最近の記録が表示されます。
                  </p>
                  <Link
                    href="/mypage/follows/search"
                    className="mt-4 inline-flex h-10 items-center rounded-xl bg-terra px-5 text-[13px] font-bold text-white"
                  >
                    ユーザーを探す
                  </Link>
                </>
              ) : (
                <p className="text-[13px] text-ink-sub">
                  フォロー中のユーザーの記録はまだありません
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {reviews.map((review) => {
                const restaurant = restaurantMap.get(review.restaurant_id)
                const profile = profileMap.get(review.user_id)
                const displayName = profile?.name ?? profile?.username ?? '...'

                const reviewImg = review.image_path
                  ? (signedReviewMap.get(review.image_path) ?? null)
                  : null
                const restaurantImg = restaurant?.main_image_path
                  ? (signedRestaurantMap.get(restaurant.main_image_path) ?? null)
                  : null
                const imageUrl = reviewImg ?? restaurantImg

                const restaurantName = restaurant
                  ? (displayNameMap.get(restaurant.id) ?? restaurant.name ?? '—')
                  : '—'

                const reasonKeys = reasonTagMap.get(review.id) ?? []
                const labelKeys = labelTagMap.get(review.id) ?? []
                const reasonTags = reasonKeys.map((k) => REASON_LABEL[k]).filter(Boolean)
                const labelTags = labelKeys.map((k) => LABEL_LABEL[k]).filter(Boolean)
                const displayTags = [...labelTags, ...reasonTags].slice(0, 2)

                const metaLine = [
                  displayName,
                  restaurant?.genre,
                  restaurant?.area,
                ].filter(Boolean).join('・')

                return (
                  <article
                    key={review.id}
                    className="relative isolate overflow-hidden border border-edge bg-surface"
                    style={{
                      borderRadius: 18,
                      boxShadow: '0 1px 6px rgba(98,55,31,0.05)',
                    }}
                  >
                    {/* Full-card tap target */}
                    <Link
                      href={`/records/${review.id}`}
                      className="absolute inset-0 z-0 transition-colors hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/40 focus-visible:ring-offset-1"
                      aria-label={`${restaurantName}の記録を見る`}
                      style={{ borderRadius: 18 }}
                    />

                    <div className="pointer-events-none flex gap-3 p-3">
                      {/* Photo — 88×88, matches VisitCardItem */}
                      <div
                        className="relative shrink-0 overflow-hidden bg-[#F3E5D8]"
                        style={{ width: 88, height: 88, borderRadius: 14 }}
                      >
                        {imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={`${restaurantName}の食事写真`}
                            fill
                            sizes="88px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <svg
                              width="22"
                              height="22"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#C9A98A"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                              <line x1="6" y1="1" x2="6" y2="4" />
                              <line x1="10" y1="1" x2="10" y2="4" />
                              <line x1="14" y1="1" x2="14" y2="4" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1 py-0.5">
                        {/* Row 1: restaurant name + rating badge — name takes flex-1, badge shrinks */}
                        <div className="flex items-start gap-2">
                          <p
                            className="min-w-0 flex-1 line-clamp-2 text-[15px] font-bold leading-snug text-ink"
                            translate={
                              restaurant?.source === 'google_place' ? 'no' : undefined
                            }
                          >
                            {restaurantName}
                          </p>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${RATING_BG[review.rating]} ${RATING_TEXT[review.rating]} ${RATING_BORDER[review.rating]}`}
                          >
                            <RatingBadgeIcon rating={review.rating} />
                            {RATING_LABELS[review.rating]}
                          </span>
                        </div>

                        {/* Row 2: author · genre · area */}
                        {metaLine && (
                          <div className="mt-0.5 flex items-center gap-1">
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="shrink-0 text-ink-sub"
                              aria-hidden="true"
                            >
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                            <p className="truncate text-[11px] text-ink-sub">
                              {metaLine}
                            </p>
                          </div>
                        )}

                        {/* Row 3: comment */}
                        {review.comment && (
                          <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-ink-sub">
                            {review.comment}
                          </p>
                        )}

                        {/* Row 4: tags */}
                        {displayTags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {displayTags.map((tag, i) => (
                              <span
                                key={i}
                                className="rounded-full bg-[#FFF0E1] px-2.5 py-0.5 text-[11px] font-semibold text-terra/80"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

      </div>
      <BottomNav />
    </main>
  )
}
