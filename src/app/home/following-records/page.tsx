import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'

type ReviewRow = {
  id: string
  restaurant_id: string
  rating: number
  comment: string | null
  visit_date: string | null
  created_at: string
  image_path: string | null
  user_id: string
}
type RestaurantRow = { id: string; name: string; area: string | null; genre: string | null }
type ProfileRow = { id: string; username: string; name: string | null; avatar_path: string | null }

const RATING_CHIP: Record<number, { label: string; bg: string; text: string }> = {
  4: { label: '常連になりたい', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  3: { label: 'また行きたい', bg: 'bg-pink-50', text: 'text-[#E05C7A]' },
  2: { label: '一度で十分', bg: 'bg-sky-50', text: 'text-sky-600' },
  1: { label: '二度と行かない', bg: 'bg-zinc-100', text: 'text-zinc-600' },
}

function formatRelativeTime(createdAt: string): string {
  const now = Date.now()
  const then = new Date(createdAt).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  if (mins < 1) return 'たった今'
  if (mins < 60) return `${mins}分前`
  if (hours < 24) return `${hours}時間前`
  if (days < 7) return `${days}日前`
  if (weeks < 5) return `${weeks}週間前`
  if (months < 12) return `${months}か月前`
  return `${Math.floor(months / 12)}年前`
}

function formatVisitDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日に訪問`
}

export default async function FollowingRecordsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const followeeResult = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', user.id)
    .eq('status', 'accepted')

  const followeeIds = ((followeeResult.data ?? []) as { followee_id: string }[]).map(f => f.followee_id)

  const recentReviewsResult = followeeIds.length > 0
    ? await supabase
        .from('reviews')
        .select('id, restaurant_id, rating, comment, visit_date, created_at, image_path, user_id')
        .in('user_id', followeeIds)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] as ReviewRow[], error: null }

  const reviews = (recentReviewsResult.data ?? []) as ReviewRow[]

  const reviewRestaurantIds = [...new Set(reviews.map(r => r.restaurant_id))]
  const reviewAuthorIds = [...new Set(reviews.map(r => r.user_id))]

  const [restaurantsResult, profilesResult] = await Promise.all([
    reviewRestaurantIds.length > 0
      ? supabase.from('restaurants').select('id, name, area, genre').in('id', reviewRestaurantIds)
      : { data: [] as RestaurantRow[], error: null },
    reviewAuthorIds.length > 0
      ? supabase.from('user_public_profiles').select('id, username, name, avatar_path').in('id', reviewAuthorIds)
      : { data: [] as ProfileRow[], error: null },
  ])

  const restaurantMap = new Map(((restaurantsResult.data ?? []) as RestaurantRow[]).map(r => [r.id, r]))
  const profileMap = new Map(((profilesResult.data ?? []) as ProfileRow[]).map(p => [p.id, p]))

  const imagePaths = reviews.flatMap(r => r.image_path ? [r.image_path] : [])
  const signedResult = imagePaths.length > 0
    ? await supabase.storage.from('review-images').createSignedUrls(imagePaths, 3600)
    : { data: [], error: null }

  const signedUrlMap = new Map<string, string>()
  for (const s of signedResult.data ?? []) {
    if (s.path && s.signedUrl && !s.error) signedUrlMap.set(s.path, s.signedUrl)
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref="/home" label="" />
        </Suspense>
        <h1 className="flex-1 text-center text-base font-bold text-ink">最近の記録</h1>
        <div className="w-10" />
      </div>

      <p className="px-4 py-2 text-center text-xs text-ink-sub">
        フォロー中の人がお店に行った記録を表示しています
      </p>

      <div className="px-4 pt-2 space-y-4">
        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center">
            <p className="text-sm text-ink-sub">フォロー中の人の記録はまだありません</p>
            {followeeIds.length === 0 && (
              <Link
                href="/mypage/follows/search"
                className="mt-4 inline-flex min-h-[40px] items-center rounded-full bg-terra px-5 text-sm font-bold text-white"
              >
                ユーザーを探す
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-4">
            {reviews.map(review => {
              const restaurant = restaurantMap.get(review.restaurant_id)
              const profile = profileMap.get(review.user_id)
              const avatarUrl = profile?.avatar_path
                ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
                : null
              const imageUrl = review.image_path ? signedUrlMap.get(review.image_path) ?? null : null
              const initial = Array.from((profile?.name ?? profile?.username ?? '?').trim())[0] ?? '?'
              const chip = RATING_CHIP[review.rating]

              return (
                <li key={review.id} className="overflow-hidden rounded-2xl border border-edge bg-surface">
                  {/* Author row */}
                  <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                    <Link
                      href={profile?.username ? `/users/${profile.username}` : '#'}
                      className="shrink-0"
                    >
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt={profile?.name ?? ''}
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-edge text-sm font-bold text-ink-sub">
                          {initial}
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={profile?.username ? `/users/${profile.username}` : '#'}
                        className="flex items-center gap-0.5 text-sm font-bold text-ink"
                      >
                        {profile?.name ?? profile?.username ?? '（名前なし）'}
                        <svg width="10" height="10" viewBox="0 0 10 18" fill="none" aria-hidden="true">
                          <path d="M1 1l8 8-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </Link>
                      {profile?.username && (
                        <p className="text-[11px] text-ink-sub">@{profile.username}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-ink-sub">
                      {formatRelativeTime(review.created_at)}
                    </span>
                    {/* 3-dot menu (visual only) */}
                    <button type="button" className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center text-ink-sub" aria-label="メニュー">
                      <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor" aria-hidden="true">
                        <circle cx="2" cy="2" r="1.5" /><circle cx="8" cy="2" r="1.5" /><circle cx="14" cy="2" r="1.5" />
                      </svg>
                    </button>
                  </div>

                  {/* Content: photo left + info right */}
                  <div className="flex min-h-[160px]">
                    {/* Left: photo */}
                    <div className="relative w-[45%] shrink-0 bg-[#3D3530]">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt="記録の写真"
                          fill
                          sizes="45vw"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full min-h-[160px] items-center justify-center bg-[#F3E5D8]">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                            <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Right: info */}
                    <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
                      <div className="space-y-1">
                        {restaurant ? (
                          <Link
                            href={`/restaurants/${restaurant.id}`}
                            className="flex items-center gap-0.5 font-bold text-terra leading-tight"
                          >
                            {restaurant.name}
                            <svg width="10" height="10" viewBox="0 0 10 18" fill="none" aria-hidden="true">
                              <path d="M1 1l8 8-8 8" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </Link>
                        ) : null}
                        {(restaurant?.genre || restaurant?.area) && (
                          <p className="text-xs text-ink-sub">
                            {[restaurant?.genre, restaurant?.area].filter(Boolean).join('・')}
                          </p>
                        )}
                        {chip && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${chip.bg} ${chip.text}`}>
                            {chip.label}
                          </span>
                        )}
                        {review.comment && (
                          <p className="line-clamp-3 text-xs leading-relaxed text-ink-sub">
                            {review.comment}
                          </p>
                        )}
                      </div>
                      {review.visit_date && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-sub">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          {formatVisitDate(review.visit_date)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Detail link */}
                  <Link
                    href={`/records/${review.id}`}
                    className="flex h-[44px] items-center justify-center gap-1 border-t border-edge text-sm font-bold text-terra hover:bg-canvas"
                  >
                    記録の詳細を見る
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </Link>
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
