import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'
import { RATING_BG, RATING_TEXT, RATING_BORDER } from '@/lib/rating/colors'

type VisitRow = {
  id: string
  restaurant_id: string
  visit_date: string | null
  rating: number
  image_path: string | null
  comment: string | null
  created_at: string
  restaurants: {
    id: string
    name: string | null
    source: string
    external_place_id: string | null
    genre: string | null
    area: string | null
    main_image_path: string | null
  } | null
}

type UserProfile = {
  name: string | null
  username: string | null
  avatar_path: string | null
  updated_at: string | null
}

type RestaurantGroup = {
  restaurantId: string
  restaurant: VisitRow['restaurants']
  visitCount: number
  repVisit: VisitRow  // first occurrence = representative (sorted by visit_date DESC)
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

const RATING_CHIP: Record<number, { label: string; bg: string; text: string; border: string }> = {
  4: { label: '常連になりたい', bg: RATING_BG[4], text: RATING_TEXT[4], border: RATING_BORDER[4] },
  3: { label: 'また行きたい',   bg: RATING_BG[3], text: RATING_TEXT[3], border: RATING_BORDER[3] },
  2: { label: '一度で十分',     bg: RATING_BG[2], text: RATING_TEXT[2], border: RATING_BORDER[2] },
  1: { label: '二度と行かない', bg: RATING_BG[1], text: RATING_TEXT[1], border: RATING_BORDER[1] },
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

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

  const { data: profileData } = await supabase
    .from('users')
    .select('name, username, avatar_path, updated_at')
    .eq('id', user.id)
    .maybeSingle()

  const profile = profileData as UserProfile | null

  const avatarUrl = profile?.avatar_path
    ? (() => {
        const raw = supabase.storage.from('avatars').getPublicUrl(profile.avatar_path!).data.publicUrl
        return profile.updated_at ? `${raw}?v=${encodeURIComponent(profile.updated_at)}` : raw
      })()
    : null

  const initial = Array.from((profile?.name ?? profile?.username ?? '?').trim())[0] ?? '?'

  // Load all visits ordered by representative sort (newest first per restaurant = first per group)
  const { data: visitsData, error: visitsError } = await supabase
    .from('restaurant_visits')
    .select('id, restaurant_id, visit_date, rating, image_path, comment, created_at, restaurants(id, name, source, external_place_id, genre, area, main_image_path)')
    .eq('user_id', user.id)
    .order('visit_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (visitsError) {
    throw new Error(`MyRecordsPage: failed to load visits: ${visitsError.message}`)
  }

  const allVisits = (visitsData ?? []) as unknown as VisitRow[]

  // Group by restaurant — first occurrence per restaurant = representative visit
  const groupMap = new Map<string, RestaurantGroup>()
  for (const visit of allVisits) {
    const existing = groupMap.get(visit.restaurant_id)
    if (!existing) {
      groupMap.set(visit.restaurant_id, {
        restaurantId: visit.restaurant_id,
        restaurant: visit.restaurants,
        visitCount: 1,
        repVisit: visit,
      })
    } else {
      existing.visitCount++
    }
  }

  const totalRestaurants = groupMap.size
  const totalVisits = allVisits.length

  // Apply rating filter (by representative visit's rating)
  let groups = [...groupMap.values()]
  if (ratingFilter !== 'all') {
    groups = groups.filter(g => g.repVisit.rating === ratingFilter)
  }

  // Apply sort
  if (sort === 'oldest') {
    groups.reverse()  // already sorted newest→oldest; reverse = oldest→newest
  }

  // Collect image paths for signed URLs
  const visitImagePaths = [...new Set(
    groups.map(g => g.repVisit.image_path).filter((p): p is string => Boolean(p))
  )]
  const restaurantImagePaths = [...new Set(
    groups.map(g => g.restaurant?.main_image_path).filter((p): p is string => Boolean(p))
  )]

  const signedVisitUrls = new Map<string, string | null>()
  if (visitImagePaths.length > 0) {
    const { data } = await supabase.storage.from('review-images').createSignedUrls(visitImagePaths, 60 * 60)
    for (const s of data ?? []) {
      if (s.path) signedVisitUrls.set(s.path, s.signedUrl)
    }
  }

  const signedRestaurantUrls = new Map<string, string>()
  if (restaurantImagePaths.length > 0) {
    const { data } = await supabase.storage.from('restaurant-images').createSignedUrls(restaurantImagePaths, 60 * 60)
    for (const s of data ?? []) {
      if (s.path && s.signedUrl && !s.error) signedRestaurantUrls.set(s.path, s.signedUrl)
    }
  }

  // Resolve display names for Google-sourced restaurants
  const restaurantDisplayNames = new Map<string, string>()
  await Promise.all(
    groups
      .map(g => g.restaurant)
      .filter((r): r is NonNullable<typeof r> => r !== null && r.source === 'google_place' && r.external_place_id !== null)
      .map(async (r) => {
        const d = await resolveRestaurantDisplay(r)
        restaurantDisplayNames.set(r.id, d.name)
      })
  )

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

  const hasAnyVisits = totalVisits > 0

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref="/mypage" label="" />
        </Suspense>
        <h1 className="flex-1 text-center text-base font-bold text-ink">自分の記録</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Profile row */}
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={profile?.name ?? profile?.username ?? 'あなた'}
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
            <p className="font-bold text-ink">{profile?.name ?? profile?.username ?? 'あなた'}</p>
            {profile?.username && (
              <p className="text-xs text-ink-sub">@{profile.username}</p>
            )}
          </div>
          <p className="shrink-0 text-sm text-ink-sub">
            <span className="text-xl font-black text-ink">{totalRestaurants}</span>店舗
            {totalVisits > totalRestaurants && (
              <span className="ml-1 text-xs">（{totalVisits}回来店）</span>
            )}
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
                sort === s ? 'bg-[#FFF3EC] text-terra' : 'text-ink-sub hover:text-ink'
              }`}
            >
              {s === 'newest' ? '新しい順' : '古い順'}
            </Link>
          ))}
        </div>

        {/* Rating filter chips */}
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
        {groups.length === 0 && (
          <div className="rounded-2xl border border-edge bg-surface px-6 py-10 text-center">
            {hasAnyVisits && ratingFilter !== 'all' ? (
              <>
                <p className="text-sm text-ink-sub">条件に合う記録がありません</p>
                <Link
                  href={`/mypage/records?sort=${sort}`}
                  replace
                  className="mt-4 inline-flex min-h-[40px] items-center rounded-full border border-edge bg-canvas px-5 text-sm font-medium text-ink"
                >
                  絞り込みを解除
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-sub">まだ記録がありません</p>
                <Link
                  href="/record"
                  className="mt-4 inline-flex min-h-[40px] items-center rounded-xl bg-terra px-5 text-sm font-medium text-white"
                >
                  記録する
                </Link>
              </>
            )}
          </div>
        )}

        {/* Restaurant groups list */}
        {groups.length > 0 && (
          <div className="divide-y divide-edge overflow-hidden rounded-2xl bg-surface">
            {groups.map((group) => {
              const repVisit = group.repVisit
              const visitImgUrl = repVisit.image_path
                ? (signedVisitUrls.get(repVisit.image_path) ?? null)
                : null
              const restaurantImgUrl = group.restaurant?.main_image_path
                ? (signedRestaurantUrls.get(group.restaurant.main_image_path) ?? null)
                : null
              const imgUrl = visitImgUrl ?? restaurantImgUrl
              const chip = RATING_CHIP[repVisit.rating]
              const dateStr = repVisit.visit_date
                ? formatDate(repVisit.visit_date)
                : formatDate(repVisit.created_at)
              const displayName = group.restaurant
                ? (restaurantDisplayNames.get(group.restaurant.id) ?? group.restaurant.name ?? '不明な店舗')
                : '不明な店舗'

              return (
                <Link
                  key={group.restaurantId}
                  href={`/mypage/records/${group.restaurantId}`}
                  className="relative flex items-start gap-3 p-4 hover:bg-canvas"
                >
                  {/* Thumbnail */}
                  {imgUrl ? (
                    <div className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={imgUrl}
                        alt={displayName}
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-[80px] w-[80px] shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
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
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 font-bold text-ink">{displayName}</p>
                      {/* Visit count badge */}
                      {group.visitCount > 1 && (
                        <span className="shrink-0 rounded-full bg-terra/10 px-2 py-0.5 text-xs font-bold text-terra">
                          {group.visitCount}回
                        </span>
                      )}
                    </div>
                    {(group.restaurant?.genre || group.restaurant?.area) && (
                      <p className="text-xs text-ink-sub">
                        {[group.restaurant.genre, group.restaurant.area].filter(Boolean).join('・')}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${chip.bg} ${chip.text} ${chip.border}`}>
                        {chip.label}
                      </span>
                      <span className="text-xs text-ink-sub">{dateStr}</span>
                    </div>
                    {repVisit.comment && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-sub">
                        {repVisit.comment}
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
