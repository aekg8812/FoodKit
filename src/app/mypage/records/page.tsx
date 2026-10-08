import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import RatingBadge, { RATING_LABELS } from '@/components/RatingBadge'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'

type ReviewRow = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  created_at: string
  image_path: string | null
  restaurants: { id: string; name: string } | null
}

type PageProps = {
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

const RATING_OPTIONS: Array<{ value: RatingFilter; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 4, label: '4' },
  { value: 3, label: '3' },
  { value: 2, label: '2' },
  { value: 1, label: '1' },
]

export default async function MyRecordsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const sort = parseSort(sp.sort)
  const ratingFilter = parseRating(sp.rating)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  let query = supabase
    .from('reviews')
    .select('id, rating, comment, visit_date, created_at, image_path, restaurants(id, name)')
    .eq('user_id', user.id)

  if (ratingFilter !== 'all') {
    query = query.eq('rating', ratingFilter)
  }

  const ascending = sort === 'oldest'
  query = query
    .order('created_at', { ascending })
    .order('id', { ascending })

  const { data, error } = await query

  if (error) {
    throw new Error(`MyRecordsPage: failed to load reviews: ${error.message}`)
  }

  const reviews = (data ?? []) as unknown as ReviewRow[]

  // Signed URLs for review images
  const imagePaths = [
    ...new Set(
      reviews
        .map((r) => r.image_path)
        .filter((p): p is string => Boolean(p)),
    ),
  ]
  const signedImagesResult = imagePaths.length
    ? await supabase.storage.from('review-images').createSignedUrls(imagePaths, 60 * 60)
    : { data: [], error: null }

  const signedImageUrls = new Map<string, string | null>()
  for (const s of signedImagesResult.data ?? []) {
    if (s.path) signedImageUrls.set(s.path, s.signedUrl)
  }

  // Get total own review count to distinguish "no records at all" vs "filter = 0"
  const { count: totalCount } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const hasAnyReviews = (totalCount ?? 0) > 0
  const isFiltered = ratingFilter !== 'all'

  function sortHref(s: SortOrder) {
    const params = new URLSearchParams()
    params.set('sort', s)
    if (ratingFilter !== 'all') params.set('rating', String(ratingFilter))
    return `/mypage/records?${params.toString()}`
  }

  function ratingHref(r: RatingFilter) {
    const params = new URLSearchParams()
    params.set('sort', sort)
    if (r !== 'all') params.set('rating', String(r))
    return `/mypage/records?${params.toString()}`
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <Suspense>
          <BackButton fallbackHref="/mypage" label="" />
        </Suspense>
        <h1 className="text-base font-bold text-ink">自分の記録</h1>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-md px-4 space-y-4">
        {/* Sort tabs — underline style */}
        <div className="flex border-b border-edge">
          {(['newest', 'oldest'] as const).map((s) => (
            <Link
              key={s}
              href={sortHref(s)}
              replace
              className={`flex flex-1 items-center justify-center py-3 text-sm font-semibold transition-colors ${
                sort === s ? 'border-b-2 border-terra text-terra' : 'text-ink-sub hover:text-ink'
              }`}
            >
              {s === 'newest' ? '新しい順' : '古い順'}
            </Link>
          ))}
        </div>

        {/* Rating filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {RATING_OPTIONS.map((opt) => (
            <Link
              key={String(opt.value)}
              href={ratingHref(opt.value)}
              replace
              className={`shrink-0 flex min-h-[32px] items-center rounded-full px-4 text-sm font-medium transition-colors ${
                ratingFilter === opt.value
                  ? 'bg-terra text-white'
                  : 'border border-edge bg-surface text-ink-sub hover:text-ink'
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>

        <p className="text-xs text-ink-sub tabular-nums">{reviews.length}件</p>

        {/* Empty state */}
        {reviews.length === 0 && (
          <div className="rounded-2xl border border-edge bg-surface p-8 text-center">
            {hasAnyReviews && isFiltered ? (
              <>
                <p className="text-sm text-ink-sub">条件に合う記録がありません</p>
                <Link
                  href={`/mypage/records?sort=${sort}`}
                  replace
                  className="mt-4 inline-flex min-h-[40px] items-center rounded-full border border-edge bg-canvas px-5 text-sm font-medium text-ink transition-colors hover:bg-surface"
                >
                  絞り込みを解除
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-sub">まだ記録がありません</p>
                <Link
                  href="/record"
                  className="mt-4 inline-flex min-h-[40px] items-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-colors hover:bg-terra-deep"
                >
                  記録する
                </Link>
              </>
            )}
          </div>
        )}

        {/* Records list */}
        {reviews.length > 0 && (
          <ul className="space-y-3">
            {reviews.map((review) => {
              const imgUrl = review.image_path
                ? signedImageUrls.get(review.image_path) ?? null
                : null
              return (
                <li key={review.id}>
                  <div className="rounded-2xl border border-edge bg-surface overflow-hidden">
                    {/* Tap record card → record detail */}
                    <Link
                      href={`/records/${review.id}`}
                      className="flex items-start gap-3 p-4 transition-colors hover:bg-canvas"
                    >
                      {imgUrl ? (
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-canvas">
                          <Image
                            src={imgUrl}
                            alt={review.restaurants?.name ?? ''}
                            fill
                            sizes="64px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="h-16 w-16 shrink-0 rounded-lg bg-canvas" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <RatingBadge rating={review.rating} />
                          <span className="text-xs text-ink-sub">{RATING_LABELS[review.rating]}</span>
                        </div>
                        {review.comment && (
                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink">
                            {review.comment}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-ink-sub">
                          {review.visit_date
                            ? `訪問日 ${review.visit_date}`
                            : `投稿日 ${review.created_at.slice(0, 10)}`}
                        </p>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-ink-sub mt-1">
                        <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                      </svg>
                    </Link>

                    {/* Tap restaurant name → restaurant detail */}
                    {review.restaurants && (
                      <div className="border-t border-edge px-4 py-2">
                        <Link
                          href={`/restaurants/${review.restaurants.id}`}
                          className="inline-flex min-h-[36px] items-center gap-1 text-sm text-terra hover:text-terra-deep font-medium"
                        >
                          {review.restaurants.name}
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                          </svg>
                        </Link>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  )
}

