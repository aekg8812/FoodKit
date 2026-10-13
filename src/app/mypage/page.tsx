import Image from 'next/image'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'

type RecentReviewRow = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  image_path: string | null
  restaurants: { id: string; name: string | null; source: string; external_place_id: string | null } | null
}

type PreferenceCardRow = {
  preference_cards: { label: string; sort_order: number } | null
}

const RATING_CHIP: Record<number, { label: string; bg: string; text: string }> = {
  4: { label: '常連になりたい', bg: 'bg-[#FFF3EC]', text: 'text-terra' },
  3: { label: 'また行きたい', bg: 'bg-[#FFF0F3]', text: 'text-[#E05C7A]' },
  2: { label: '一度で十分', bg: 'bg-[#EFF6FF]', text: 'text-sky-600' },
  1: { label: '二度と行かない', bg: 'bg-[#F3F4F6]', text: 'text-zinc-600' },
}

function formatDate(visitDate: string | null): string {
  if (!visitDate) return ''
  const d = new Date(visitDate)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default async function MypagePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [
    profileResult,
    reviewsForStatsResult,
    recentReviewsResult,
    preferenceCardsResult,
    followCountsResult,
  ] = await Promise.all([
    supabase
      .from('user_public_profiles')
      .select('id, username, name, avatar_path, updated_at')
      .eq('id', user.id)
      .single(),
    supabase
      .from('reviews')
      .select('id, rating, restaurant_id')
      .eq('user_id', user.id),
    supabase
      .from('reviews')
      .select('id, rating, comment, visit_date, image_path, restaurants(id, name, source, external_place_id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(3),
    supabase
      .from('user_preference_cards')
      .select('preference_cards(label, sort_order)')
      .eq('user_id', user.id),
    supabase.rpc('get_user_follow_counts', { p_user_id: user.id }),
  ])

  if (profileResult.error) {
    throw new Error(`MypagePage: failed to load profile: ${profileResult.error.message}`)
  }

  const profile = profileResult.data
  const allReviews = reviewsForStatsResult.data ?? []
  const reviewCount = allReviews.length
  const restaurantCount = new Set(allReviews.map((r) => r.restaurant_id)).size

  const ratingCounts: Record<number, number> = { 4: 0, 3: 0, 2: 0, 1: 0 }
  for (const r of allReviews) {
    if (r.rating >= 1 && r.rating <= 4) ratingCounts[r.rating]++
  }

  const recentRows = (recentReviewsResult.data ?? []) as unknown as RecentReviewRow[]
  const followCounts = followCountsResult.data?.[0] ?? { following_count: 0, follower_count: 0 }

  const preferenceCards = (preferenceCardsResult.data ?? [])
    .map((row) => {
      const pc = (row as unknown as PreferenceCardRow).preference_cards
      return pc ?? null
    })
    .filter((c): c is { label: string; sort_order: number } => c !== null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 5)

  // Signed URLs for recent review images
  const imagePaths = [
    ...new Set(
      recentRows
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

  const avatarRaw = profile.avatar_path
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null
  const avatarUrl =
    avatarRaw && profile.updated_at
      ? `${avatarRaw}?v=${encodeURIComponent(profile.updated_at)}`
      : avatarRaw

  const initial: string = (profile.name ?? profile.username ?? '?').trim().charAt(0) || '?'

  // Resolve display names for Google-sourced restaurants in recent reviews
  const recentRestaurantDisplayNames = new Map<string, string>()
  await Promise.all(
    recentRows
      .map(r => r.restaurants)
      .filter((r): r is NonNullable<typeof r> => r !== null && r.source === 'google_place' && r.external_place_id !== null)
      .map(async (r) => {
        const d = await resolveRestaurantDisplay(r)
        recentRestaurantDisplayNames.set(r.id, d.name)
      }),
  )

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center px-4 pt-14 pb-3">
        <div className="w-10" />
        <h1 className="flex-1 text-center text-base font-bold text-ink">マイページ</h1>
        <Link
          href="/settings"
          aria-label="設定"
          className="flex h-10 w-10 items-center justify-center text-ink-sub"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </Link>
      </div>

      <div className="px-4 space-y-5">
        {/* Profile card */}
        <section className="rounded-2xl bg-surface p-4">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={profile.name ?? profile.username ?? ''}
                width={72}
                height={72}
                className="h-[72px] w-[72px] shrink-0 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-edge text-2xl font-bold text-ink-sub">
                {initial}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-ink">{profile.name ?? profile.username}</p>
              {profile.username && (
                <p className="truncate text-sm text-ink-sub">@{profile.username}</p>
              )}
            </div>
            <Link
              href="/mypage/profile/edit"
              className="shrink-0 rounded-full border border-terra px-4 py-1.5 text-sm font-bold text-terra"
            >
              プロフィールを編集
            </Link>
          </div>

          {/* Stats row */}
          <div className="mt-4 flex divide-x divide-edge border-t border-edge pt-4">
            <div className="flex-1 text-center">
              <p className="text-xl font-black tabular-nums text-ink">{reviewCount}</p>
              <p className="text-xs text-ink-sub">記録</p>
            </div>
            <Link href="/mypage/follows?tab=following" className="flex-1 text-center">
              <p className="text-xl font-black tabular-nums text-ink">{Number(followCounts.following_count)}</p>
              <p className="text-xs text-ink-sub">フォロー</p>
            </Link>
            <Link href="/mypage/follows?tab=followers" className="flex-1 text-center">
              <p className="text-xl font-black tabular-nums text-ink">{Number(followCounts.follower_count)}</p>
              <p className="text-xs text-ink-sub">フォロワー</p>
            </Link>
          </div>
        </section>

        {/* あなたの好み */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-ink">あなたの好み</h2>
              <p className="text-xs text-ink-sub">店選びで大切にしていること</p>
            </div>
            <Link href="/mypage/food-preferences" className="text-sm font-medium text-terra">
              編集 ›
            </Link>
          </div>

          {preferenceCards.length === 0 ? (
            <div className="rounded-2xl border border-edge bg-surface p-5 text-center">
              <p className="text-sm text-ink-sub">まだ好みが設定されていません</p>
              <Link
                href="/mypage/food-preferences/edit"
                className="mt-3 inline-flex h-[40px] items-center rounded-xl bg-terra px-5 text-sm font-medium text-white"
              >
                好みを設定する
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {preferenceCards.map((card, i) => (
                <span
                  key={i}
                  className="rounded-full border border-terra/30 bg-terra/10 px-3 py-1.5 text-sm font-medium text-terra"
                >
                  {card.label}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* これまでの記録 */}
        {reviewCount > 0 && (
          <section>
            <h2 className="mb-2 font-bold text-ink">これまでの記録</h2>
            <div className="overflow-hidden rounded-2xl bg-surface">
              <div className="flex items-center gap-3 border-b border-edge p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terra/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <span className="text-base font-black text-ink">{restaurantCount}店舗を記録</span>
              </div>
              <div className="grid grid-cols-4 divide-x divide-edge px-0 py-3">
                {([4, 3, 2, 1] as const).map((rating) => (
                  <div key={rating} className="flex flex-col items-center py-1">
                    <p className={`text-lg font-black tabular-nums ${rating === 3 ? 'text-terra' : 'text-ink'}`}>
                      {ratingCounts[rating]}
                    </p>
                    <p className="mt-0.5 text-center text-[10px] leading-tight text-ink-sub">
                      {rating === 4 ? '常連に\nなりたい' : rating === 3 ? 'また\n行きたい' : rating === 2 ? '一度で\n十分' : '二度と\n行かない'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 最近の記録 */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold text-ink">最近の記録</h2>
            <Link href="/mypage/records" className="text-sm font-medium text-terra">
              すべて見る ›
            </Link>
          </div>

          {recentRows.length === 0 ? (
            <div className="rounded-2xl border border-edge bg-surface p-6 text-center">
              <p className="text-sm text-ink-sub">まだ記録がありません</p>
              <Link
                href="/record"
                className="mt-3 inline-flex h-[40px] items-center rounded-xl bg-terra px-5 text-sm font-medium text-white"
              >
                記録する
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-surface">
              {recentRows.map((review) => {
                const imgUrl = review.image_path
                  ? signedImageUrls.get(review.image_path) ?? null
                  : null
                const chip = RATING_CHIP[review.rating]
                return (
                  <Link
                    key={review.id}
                    href={`/records/${review.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-canvas"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl bg-[#F3E5D8]">
                      {imgUrl ? (
                        <Image
                          src={imgUrl}
                          alt={review.restaurants?.name ?? ''}
                          fill
                          sizes="60px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                    <div className="min-w-0 flex-1">
                      {review.restaurants && (
                        <p className="truncate text-sm font-bold text-terra">
                          {recentRestaurantDisplayNames.get(review.restaurants.id) ?? review.restaurants.name ?? '—'}
                        </p>
                      )}
                      <div className="mt-0.5 flex items-center gap-2">
                        {chip && (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${chip.bg} ${chip.text}`}>
                            {chip.label}
                          </span>
                        )}
                        {review.visit_date && (
                          <span className="text-[11px] text-ink-sub">{formatDate(review.visit_date)}</span>
                        )}
                      </div>
                      {review.comment && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-ink-sub">{review.comment}</p>
                      )}
                    </div>
                    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                      <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Bottom menu links */}
        <section>
          <div className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-surface">
            <Link href="/mypage/follows" className="flex items-center gap-3 px-4 py-4 hover:bg-canvas">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className="flex-1 font-medium text-ink">フォロー・フォロワー</span>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/mypage/food-preferences/edit" className="flex items-center gap-3 px-4 py-4 hover:bg-canvas">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span className="flex-1 font-medium text-ink">好みカードを編集</span>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/settings" className="flex items-center gap-3 px-4 py-4 hover:bg-canvas">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
              <span className="flex-1 font-medium text-ink">設定</span>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  )
}
