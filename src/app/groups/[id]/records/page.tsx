import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'
import { RATING_BG, RATING_TEXT, RATING_BORDER } from '@/lib/rating/colors'

const PAGE_SIZE = 20

type GroupRow = { id: string; name: string }

type ProfileRow = {
  id: string
  username: string | null
  name: string | null
  avatar_path: string | null
}

type ReviewRow = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  created_at: string
  image_path: string | null
  user_id: string
  restaurants: {
    id: string
    name: string | null
    source: string
    external_place_id: string | null
    genre: string | null
    area: string | null
  } | null
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const RATING_CHIP: Record<number, { label: string; bg: string; text: string; border: string }> = {
  4: { label: '常連になりたい', bg: RATING_BG[4], text: RATING_TEXT[4], border: RATING_BORDER[4] },
  3: { label: 'また行きたい', bg: RATING_BG[3], text: RATING_TEXT[3], border: RATING_BORDER[3] },
  2: { label: '一度で十分', bg: RATING_BG[2], text: RATING_TEXT[2], border: RATING_BORDER[2] },
  1: { label: '二度と行かない', bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-300' },
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${days[d.getDay()]})`
}

function parsePage(raw: string | string[] | undefined): number {
  const n = parseInt(String(raw ?? '1'), 10)
  return isNaN(n) || n < 1 ? 1 : n
}

export default async function GroupRecordsPage({ params, searchParams }: PageProps) {
  const { id: groupId } = await params
  const sp = await searchParams
  const page = parsePage(sp.page)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // Verify group exists and current user is a member
  const [groupResult, memberIdsResult] = await Promise.all([
    supabase.from('groups').select('id, name').eq('id', groupId).maybeSingle(),
    supabase.from('group_members').select('user_id').eq('group_id', groupId),
  ])

  if (groupResult.error) {
    throw new Error(`GroupRecordsPage: group query failed: ${groupResult.error.message}`)
  }
  if (!groupResult.data) notFound()

  if (memberIdsResult.error) {
    throw new Error(`GroupRecordsPage: member query failed: ${memberIdsResult.error.message}`)
  }

  const group = groupResult.data as GroupRow
  const memberUserIds = ((memberIdsResult.data ?? []) as { user_id: string }[]).map((m) => m.user_id)

  // Non-members cannot view group records
  if (!memberUserIds.includes(user.id)) notFound()

  if (memberUserIds.length === 0) {
    return (
      <main className="min-h-screen bg-canvas pb-24">
        <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
          <Suspense>
            <BackButton fallbackHref={`/groups/${groupId}`} label="" />
          </Suspense>
          <h1 className="flex-1 text-center text-base font-bold text-ink">メンバーの記録</h1>
          <div className="w-10" />
        </div>
        <div className="px-4 pt-8 text-center">
          <p className="text-sm text-ink-sub">まだ記録がありません</p>
        </div>
        <BottomNav />
      </main>
    )
  }

  // Count total records for pagination
  const countResult = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .in('user_id', memberUserIds)

  const totalCount = countResult.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * PAGE_SIZE

  // Fetch paginated reviews
  const reviewsResult = await supabase
    .from('reviews')
    .select(
      'id, rating, comment, visit_date, created_at, image_path, user_id, restaurants(id, name, source, external_place_id, genre, area)',
    )
    .in('user_id', memberUserIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (reviewsResult.error) {
    throw new Error(`GroupRecordsPage: reviews query failed: ${reviewsResult.error.message}`)
  }

  const reviews = (reviewsResult.data ?? []) as unknown as ReviewRow[]

  // Fetch author profiles
  const authorIds = [...new Set(reviews.map((r) => r.user_id))]
  const profilesResult = authorIds.length > 0
    ? await supabase
        .from('user_public_profiles')
        .select('id, username, name, avatar_path')
        .in('id', authorIds)
    : { data: [] as ProfileRow[], error: null }

  const profileMap = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  )

  // Resolve Google Places restaurant display names
  const restaurantDisplayNames = new Map<string, string>()
  await Promise.all(
    reviews
      .flatMap((r) => (r.restaurants ? [r.restaurants] : []))
      .filter((r, idx, arr) => arr.findIndex((x) => x.id === r.id) === idx)
      .filter((r) => r.source === 'google_place' && r.external_place_id)
      .map(async (r) => {
        const d = await resolveRestaurantDisplay(r)
        restaurantDisplayNames.set(r.id, d.name)
      }),
  )

  // Sign review image URLs
  const imagePaths = [
    ...new Set(reviews.map((r) => r.image_path).filter((p): p is string => Boolean(p))),
  ]
  const signedImagesResult = imagePaths.length
    ? await supabase.storage.from('review-images').createSignedUrls(imagePaths, 3600)
    : { data: [], error: null }

  const signedImageUrls = new Map<string, string>()
  for (const item of signedImagesResult.data ?? []) {
    if (item.path && !item.error && item.signedUrl) {
      signedImageUrls.set(item.path, item.signedUrl)
    }
  }

  function pageHref(p: number) {
    return `/groups/${groupId}/records?page=${p}`
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref={`/groups/${groupId}`} label="" />
        </Suspense>
        <h1 className="flex-1 text-center text-base font-bold text-ink">メンバーの記録</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Record count */}
        <p className="text-xs text-ink-sub">
          {group.name}のメンバーが投稿した記録 — 全{totalCount}件
        </p>

        {/* Empty state */}
        {reviews.length === 0 && (
          <div className="rounded-2xl border border-edge bg-surface px-6 py-12 text-center">
            <p className="text-sm text-ink-sub">まだ記録がありません</p>
          </div>
        )}

        {/* Records list */}
        {reviews.length > 0 && (
          <div className="divide-y divide-edge overflow-hidden rounded-2xl bg-surface">
            {reviews.map((review) => {
              const author = profileMap.get(review.user_id)
              const avatarUrl = author?.avatar_path
                ? supabase.storage.from('avatars').getPublicUrl(author.avatar_path).data.publicUrl
                : null
              const authorInitial =
                Array.from((author?.name ?? author?.username ?? '?').trim())[0] ?? '?'
              const imgUrl = review.image_path
                ? signedImageUrls.get(review.image_path) ?? null
                : null
              const chip = RATING_CHIP[review.rating]
              const restaurantName = review.restaurants
                ? (restaurantDisplayNames.get(review.restaurants.id) ?? review.restaurants.name ?? '—')
                : '—'
              const dateStr = review.visit_date
                ? formatDate(review.visit_date)
                : formatDate(review.created_at)

              return (
                <Link
                  key={review.id}
                  href={`/records/${review.id}`}
                  className="flex items-start gap-3 p-4 hover:bg-canvas"
                >
                  {/* Author avatar */}
                  <div className="shrink-0">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={author?.name ?? ''}
                        width={36}
                        height={36}
                        className="h-9 w-9 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-edge text-sm font-bold text-ink-sub">
                        {authorInitial}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink-sub">
                      {author?.name ?? author?.username ?? ''}さん
                    </p>
                    <p className="font-bold text-terra leading-tight">{restaurantName}</p>
                    {review.restaurants && (review.restaurants.genre || review.restaurants.area) && (
                      <p className="text-xs text-ink-sub">
                        {[review.restaurants.genre, review.restaurants.area].filter(Boolean).join('・')}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {chip && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-bold ${chip.bg} ${chip.text} ${chip.border}`}
                        >
                          {chip.label}
                        </span>
                      )}
                      <span className="text-xs text-ink-sub">{dateStr}</span>
                    </div>
                    {review.comment && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-sub">
                        {review.comment}
                      </p>
                    )}
                  </div>

                  {/* Thumbnail */}
                  {imgUrl ? (
                    <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={imgUrl}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
                      <svg
                        width="20"
                        height="20"
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

                  <svg
                    width="8"
                    height="14"
                    viewBox="0 0 8 14"
                    fill="none"
                    className="mt-1 shrink-0 text-ink-sub"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 1l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav aria-label="ページ切り替え" className="flex items-center justify-between gap-2">
            {currentPage > 1 ? (
              <Link
                href={pageHref(currentPage - 1)}
                className="flex h-[44px] flex-1 items-center justify-center rounded-xl border border-edge bg-surface text-sm font-medium text-ink hover:bg-canvas"
              >
                ← 前の{PAGE_SIZE}件
              </Link>
            ) : (
              <div className="flex-1" />
            )}

            <span className="shrink-0 text-xs text-ink-sub">
              {currentPage} / {totalPages}
            </span>

            {currentPage < totalPages ? (
              <Link
                href={pageHref(currentPage + 1)}
                className="flex h-[44px] flex-1 items-center justify-center rounded-xl border border-edge bg-surface text-sm font-medium text-ink hover:bg-canvas"
              >
                次の{PAGE_SIZE}件 →
              </Link>
            ) : (
              <div className="flex-1" />
            )}
          </nav>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
