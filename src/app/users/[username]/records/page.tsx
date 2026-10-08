import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'

type ProfileRow = {
  id: string
  username: string
  name: string | null
  avatar_path: string | null
  updated_at: string | null
}

type ReviewRow = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  created_at: string
  image_path: string | null
  restaurants: { id: string; name: string; genre: string | null; area: string | null } | null
}

type PageProps = {
  params: Promise<{ username: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type SortOrder = 'newest' | 'oldest'
type RatingFilter = 'all' | 1 | 2 | 3 | 4

function parseSort(raw: string | string[] | undefined): SortOrder {
  if (raw === 'oldest') return 'oldest'
  return 'newest'
}

function parseRating(raw: string | string[] | undefined): RatingFilter {
  const n = Number(raw)
  if (n === 1 || n === 2 || n === 3 || n === 4) return n
  return 'all'
}

const RATING_CHIP: Record<number, { label: string; bg: string; text: string; border: string }> = {
  4: { label: '常連になりたい', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  3: { label: 'また行きたい', bg: 'bg-pink-50', text: 'text-[#E05C7A]', border: 'border-pink-300' },
  2: { label: '一度で十分', bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-300' },
  1: { label: '二度と行かない', bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-300' },
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export default async function UserRecordsPage({ params, searchParams }: PageProps) {
  const { username } = await params
  const sp = await searchParams
  const sort = parseSort(sp.sort)
  const ratingFilter = parseRating(sp.rating)

  const supabase = await createClient()

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser()
  if (!viewer) redirect('/login')

  const state = await getUserState(supabase, viewer)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data: profileData, error: profileError } = await supabase
    .from('user_public_profiles')
    .select('id, username, name, avatar_path, updated_at')
    .ilike('username', escapeLikePattern(username))
    .limit(1)
    .maybeSingle()

  if (profileError) throw new Error(`UserRecordsPage: profile query failed: ${profileError.message}`)
  if (!profileData) notFound()

  const profile = profileData as ProfileRow

  const avatarUrl = profile.avatar_path
    ? (() => {
        const raw = supabase.storage.from('avatars').getPublicUrl(profile.avatar_path!).data.publicUrl
        return profile.updated_at ? `${raw}?v=${encodeURIComponent(profile.updated_at)}` : raw
      })()
    : null

  const initial = Array.from((profile.name ?? profile.username ?? '?').trim())[0] ?? '?'
  const displayName = profile.name ?? profile.username ?? ''

  let query = supabase
    .from('reviews')
    .select('id, rating, comment, visit_date, created_at, image_path, restaurants(id, name, genre, area)')
    .eq('user_id', profile.id)

  if (ratingFilter !== 'all') {
    query = query.eq('rating', ratingFilter)
  }

  const ascending = sort === 'oldest'
  query = query.order('created_at', { ascending }).order('id', { ascending })

  const [reviewsResult, totalCountResult] = await Promise.all([
    query,
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id),
  ])

  if (reviewsResult.error) throw new Error(`UserRecordsPage: reviews query failed: ${reviewsResult.error.message}`)

  const reviews = (reviewsResult.data ?? []) as unknown as ReviewRow[]
  const totalCount = totalCountResult.count ?? 0
  const hasAnyReviews = totalCount > 0

  const imagePaths = [
    ...new Set(reviews.map((r) => r.image_path).filter((p): p is string => Boolean(p))),
  ]
  const signedImagesResult = imagePaths.length
    ? await supabase.storage.from('review-images').createSignedUrls(imagePaths, 60 * 60)
    : { data: [], error: null }

  const signedImageUrls = new Map<string, string | null>()
  for (const s of signedImagesResult.data ?? []) {
    if (s.path) signedImageUrls.set(s.path, s.signedUrl)
  }

  const baseHref = `/users/${profile.username}/records`

  function sortHref(s: SortOrder) {
    const p = new URLSearchParams()
    p.set('sort', s)
    if (ratingFilter !== 'all') p.set('rating', String(ratingFilter))
    return `${baseHref}?${p.toString()}`
  }

  function ratingHref(r: RatingFilter) {
    const p = new URLSearchParams()
    p.set('sort', sort)
    if (r !== 'all') p.set('rating', String(r))
    return `${baseHref}?${p.toString()}`
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref={`/users/${profile.username}`} label="" />
        </Suspense>
        <h1 className="flex-1 text-center text-base font-bold text-ink">
          {displayName}の記録
        </h1>
        <div className="w-10" />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Profile row */}
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={52}
              height={52}
              className="h-[52px] w-[52px] rounded-full object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-edge text-lg font-bold text-ink-sub">
              {initial}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{displayName}</p>
            <p className="text-xs text-ink-sub">@{profile.username}</p>
          </div>
          <p className="shrink-0 text-sm text-ink-sub">
            <span className="text-xl font-black text-ink">{totalCount}</span>件の記録
          </p>
        </div>

        {/* Sort toggle */}
        <div className="flex overflow-hidden rounded-full border border-edge bg-surface p-1 gap-1">
          {(['newest', 'oldest'] as const).map((s) => (
            <Link
              key={s}
              href={sortHref(s)}
              replace
              className={`flex flex-1 items-center justify-center rounded-full py-2.5 text-sm font-bold transition-colors ${
                sort === s ? 'bg-terra text-white' : 'text-ink-sub hover:text-ink'
              }`}
            >
              {s === 'newest' ? '新しい順' : '古い順'}
            </Link>
          ))}
        </div>

        {/* Rating filter chips — horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href={ratingHref('all')}
            replace
            className={`shrink-0 flex h-[34px] items-center rounded-full border px-4 text-sm font-bold transition-colors ${
              ratingFilter === 'all'
                ? 'border-terra bg-[#FFF3EC] text-terra'
                : 'border-edge bg-surface text-ink-sub hover:text-ink'
            }`}
          >
            すべて
          </Link>
          {([4, 3, 2, 1] as const).map((r) => {
            const chip = RATING_CHIP[r]
            const isActive = ratingFilter === r
            return (
              <Link
                key={r}
                href={ratingHref(r)}
                replace
                className={`shrink-0 flex h-[34px] items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                  isActive
                    ? `${chip.bg} ${chip.text} ${chip.border}`
                    : 'border-edge bg-surface text-ink-sub hover:text-ink'
                }`}
              >
                {chip.label}
              </Link>
            )
          })}
        </div>

        {/* Empty state */}
        {reviews.length === 0 && (
          <div className="rounded-2xl border border-edge bg-surface px-6 py-10 text-center">
            {hasAnyReviews && ratingFilter !== 'all' ? (
              <>
                <p className="text-sm text-ink-sub">条件に合う記録がありません</p>
                <Link
                  href={`${baseHref}?sort=${sort}`}
                  replace
                  className="mt-4 inline-flex min-h-[40px] items-center rounded-full border border-edge bg-canvas px-5 text-sm font-medium text-ink"
                >
                  絞り込みを解除
                </Link>
              </>
            ) : (
              <p className="text-sm text-ink-sub">まだ記録がありません</p>
            )}
          </div>
        )}

        {/* Records list */}
        {reviews.length > 0 && (
          <div className="divide-y divide-edge overflow-hidden rounded-2xl bg-surface">
            {reviews.map((review) => {
              const imgUrl = review.image_path
                ? signedImageUrls.get(review.image_path) ?? null
                : null
              const chip = RATING_CHIP[review.rating]
              const dateStr = review.visit_date
                ? formatDate(review.visit_date)
                : formatDate(review.created_at)

              return (
                <Link
                  key={review.id}
                  href={`/records/${review.id}`}
                  className="flex items-start gap-3 p-4 hover:bg-canvas"
                >
                  {/* Thumbnail */}
                  {imgUrl ? (
                    <div className="relative h-[70px] w-[70px] shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={imgUrl}
                        alt={review.restaurants?.name ?? ''}
                        fill
                        sizes="70px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                        <line x1="6" y1="1" x2="6" y2="4" />
                        <line x1="10" y1="1" x2="10" y2="4" />
                        <line x1="14" y1="1" x2="14" y2="4" />
                      </svg>
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-terra">
                      {review.restaurants?.name ?? '不明な店舗'}
                    </p>
                    {(review.restaurants?.genre || review.restaurants?.area) && (
                      <p className="text-xs text-ink-sub">
                        {[review.restaurants.genre, review.restaurants.area].filter(Boolean).join('・')}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${chip.bg} ${chip.text} ${chip.border}`}>
                        {chip.label}
                      </span>
                      <span className="text-xs text-ink-sub">{dateStr}</span>
                    </div>
                    {review.comment && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-sub">
                        {review.comment}
                      </p>
                    )}
                  </div>

                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="mt-1 shrink-0 text-ink-sub" aria-hidden="true">
                    <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
