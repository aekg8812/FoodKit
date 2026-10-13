import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import { getUserState } from '@/lib/auth/getUserState'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'

type ReviewRow = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  created_at: string
  image_path: string | null
  user_id: string
  restaurant_id: string
  restaurants: {
    id: string
    name: string | null
    source: string
    external_place_id: string | null
    area: string | null
    genre: string | null
    address: string | null
  } | null
}

type UserProfile = {
  id: string
  username: string | null
  name: string | null
  avatar_path: string | null
  updated_at: string | null
}

type PageProps = {
  params: Promise<{ reviewId: string }>
}

const RATING_LABEL: Record<number, string> = {
  4: '常連になりたい',
  3: 'また行きたい',
  2: '一度で十分',
  1: '二度と行かない',
}

const RATING_SUBLABEL: Record<number, string> = {
  4: 'ぜひ定期的に通いたいお店',
  3: '機会があればもう一度行きたい',
  2: '一度体験できたので十分',
  1: '残念ながらまた行こうとは思わない',
}

const RATING_STYLE: Record<number, { bg: string; chipBg: string; text: string; subText: string }> = {
  4: { bg: 'bg-[#FFF3EC]', chipBg: 'bg-orange-100', text: 'text-terra', subText: 'text-terra' },
  3: { bg: 'bg-[#FFF0F3]', chipBg: 'bg-pink-100', text: 'text-[#E05C7A]', subText: 'text-[#E05C7A]' },
  2: { bg: 'bg-[#EFF6FF]', chipBg: 'bg-sky-100', text: 'text-sky-600', subText: 'text-sky-500' },
  1: { bg: 'bg-[#F3F4F6]', chipBg: 'bg-zinc-200', text: 'text-zinc-600', subText: 'text-zinc-500' },
}

function RatingIllustration({ rating }: { rating: number }) {
  if (rating === 4) return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle cx="26" cy="26" r="22" fill="#F97316" opacity="0.12" />
      {/* Crown */}
      <path d="M14 34 L16 20 L22 27 L26 18 L30 27 L36 20 L38 34 Z" fill="#F97316" opacity="0.85" />
      <rect x="13" y="34" width="26" height="3" rx="1.5" fill="#F97316" opacity="0.85" />
    </svg>
  )
  if (rating === 3) return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle cx="26" cy="26" r="22" fill="#E05C7A" opacity="0.1" />
      {/* Clinking glasses */}
      <path d="M20 16 L17 28 Q17 32 21 32 L20 38" stroke="#E05C7A" strokeWidth="2" strokeLinecap="round" opacity="0.85" fill="none" />
      <path d="M32 16 L35 28 Q35 32 31 32 L32 38" stroke="#E05C7A" strokeWidth="2" strokeLinecap="round" opacity="0.85" fill="none" />
      <line x1="18" y1="38" x2="22" y2="38" stroke="#E05C7A" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      <line x1="30" y1="38" x2="34" y2="38" stroke="#E05C7A" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      {/* sparkles */}
      <line x1="26" y1="13" x2="26" y2="11" stroke="#E05C7A" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="23" y1="14" x2="22" y2="12" stroke="#E05C7A" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="29" y1="14" x2="30" y2="12" stroke="#E05C7A" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
  if (rating === 2) return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle cx="26" cy="26" r="22" fill="#0EA5E9" opacity="0.1" />
      {/* Fork & knife */}
      <line x1="22" y1="16" x2="22" y2="36" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      <path d="M19 16 L19 24 Q22 26 25 24 L25 16" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" fill="none" />
      <path d="M30 16 Q30 22 30 24 Q32 26 32 28 L32 36" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" opacity="0.8" fill="none" />
    </svg>
  )
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle cx="26" cy="26" r="22" fill="#6B7280" opacity="0.08" />
      {/* Thumbs down */}
      <path d="M26 34 C22 34 18 30 18 26 L18 22 L28 22 L28 18 L32 18 L32 26 C32 26 30 34 26 34Z" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" fill="none" />
    </svg>
  )
}

function formatRelativeTime(createdAt: string): string {
  const now = Date.now()
  const then = new Date(createdAt).getTime()
  const diffMs = now - then
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffMinutes < 1) return 'たった今'
  if (diffMinutes < 60) return `${diffMinutes}分前`
  if (diffHours < 24) return `${diffHours}時間前`
  if (diffDays < 7) return `${diffDays}日前`
  if (diffWeeks < 5) return `${diffWeeks}週間前`
  if (diffMonths < 12) return `${diffMonths}か月前`
  return `${Math.floor(diffMonths / 12)}年前`
}

function formatVisitDate(visitDate: string): string {
  const d = new Date(visitDate)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${days[d.getDay()]})`
}

export default async function RecordDetailPage({ params }: PageProps) {
  const { reviewId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/records/[reviewId]', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data: reviewData, error: reviewError } = await supabase
    .from('reviews')
    .select(
      'id, rating, comment, visit_date, created_at, image_path, user_id, restaurant_id, restaurants(id, name, source, external_place_id, area, genre, address)',
    )
    .eq('id', reviewId)
    .maybeSingle()

  if (reviewError) {
    throw new Error(`RecordDetailPage: review query failed: ${reviewError.message}`)
  }
  if (!reviewData) notFound()

  const review = reviewData as unknown as ReviewRow

  const { data: profileData, error: profileError } = await supabase
    .from('user_public_profiles')
    .select('id, username, name, avatar_path, updated_at')
    .eq('id', review.user_id)
    .maybeSingle()

  if (profileError) {
    throw new Error(`RecordDetailPage: profile query failed: ${profileError.message}`)
  }

  const profile = profileData as UserProfile | null

  let imageUrl: string | null = null
  if (review.image_path) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from('review-images')
      .createSignedUrl(review.image_path, 60 * 60)
    if (signedError) {
      console.error('RecordDetailPage: failed to sign review image', signedError)
    } else {
      imageUrl = signedData?.signedUrl ?? null
    }
  }

  const avatarUrl = profile?.avatar_path
    ? (() => {
        const raw = supabase.storage.from('avatars').getPublicUrl(profile.avatar_path!).data.publicUrl
        return profile.updated_at
          ? `${raw}?v=${encodeURIComponent(profile.updated_at)}`
          : raw
      })()
    : null

  const isOwn = review.user_id === user.id
  const initial = Array.from((profile?.name ?? profile?.username ?? '?').trim())[0] ?? '?'
  const restaurant = review.restaurants
  const ratingStyle = RATING_STYLE[review.rating] ?? RATING_STYLE[3]

  const restaurantDisplay = restaurant
    ? await resolveRestaurantDisplay(restaurant)
    : null

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref={review.restaurant_id ? `/restaurants/${review.restaurant_id}` : '/home'} label="" />
        </Suspense>
        <h1 className="flex-1 text-center text-base font-bold text-ink">記録詳細</h1>
        {isOwn ? (
          <Link
            href={`/records/${reviewId}/edit`}
            className="flex h-10 items-center justify-center px-1 text-sm font-bold text-terra"
          >
            編集
          </Link>
        ) : (
          <div className="w-10" />
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* User + time row */}
        <div className="flex items-center gap-3">
          <Link href={profile?.username ? `/users/${profile.username}` : '#'} className="shrink-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={profile?.name ?? profile?.username ?? ''}
                width={44}
                height={44}
                className="h-11 w-11 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-edge text-base font-bold text-ink-sub">
                {initial}
              </span>
            )}
          </Link>
          <div className="min-w-0">
            <Link href={profile?.username ? `/users/${profile.username}` : '#'} className="font-bold text-ink">
              {profile?.name ?? profile?.username ?? '不明'}
            </Link>
            {profile?.username && (
              <p className="text-xs text-ink-sub">@{profile.username}</p>
            )}
          </div>
          <span className="ml-auto shrink-0 text-xs text-ink-sub">
            {formatRelativeTime(review.created_at)}
          </span>
        </div>

        {/* Restaurant card */}
        {restaurant && restaurantDisplay && (
          <Link
            href={`/restaurants/${restaurant.id}`}
            className="flex items-center gap-3 overflow-hidden rounded-2xl border border-edge bg-surface p-3"
          >
            <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink" translate={restaurantDisplay.isGoogle ? 'no' : undefined}>{restaurantDisplay.name}</p>
              {(restaurant.area || restaurant.genre) && (
                <p className="text-xs text-ink-sub">{[restaurant.genre, restaurant.area].filter(Boolean).join('・')}</p>
              )}
              {(restaurantDisplay.address ?? restaurant.address) && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-sub">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="10" r="3" />
                    <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z" />
                  </svg>
                  <span translate={restaurantDisplay.isGoogle ? 'no' : undefined}>
                    {restaurantDisplay.address ?? restaurant.address}
                  </span>
                </p>
              )}
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
              <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}

        {/* Rating card */}
        <div className={`rounded-2xl ${ratingStyle.bg} p-4`}>
          <p className="mb-3 text-sm font-medium text-ink">このお店に、もう一度行きたいですか？</p>
          <div className="flex items-center justify-between">
            <div>
              <span className={`inline-block rounded-full px-4 py-1.5 text-base font-bold ${ratingStyle.chipBg} ${ratingStyle.text}`}>
                {RATING_LABEL[review.rating]}
              </span>
              <p className={`mt-2 text-xs ${ratingStyle.subText}`}>{RATING_SUBLABEL[review.rating]}</p>
            </div>
            <RatingIllustration rating={review.rating} />
          </div>
        </div>

        {/* Comment */}
        {review.comment && (
          <div>
            <h2 className="mb-2 text-base font-bold text-ink">ひとこと</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{review.comment}</p>
          </div>
        )}

        {/* Photo */}
        {imageUrl && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">写真</h2>
              <span className="text-xs text-ink-sub">1枚</span>
            </div>
            <div className="overflow-hidden rounded-2xl bg-canvas">
              <Image
                src={imageUrl}
                alt="記録の写真"
                width={343}
                height={257}
                className="h-auto w-full object-cover"
                unoptimized
              />
            </div>
          </div>
        )}

        {/* Visit date */}
        {review.visit_date && (
          <div className="flex items-center gap-2 text-sm text-ink-sub">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>訪問日</span>
            <span className="font-medium text-ink">{formatVisitDate(review.visit_date)}</span>
          </div>
        )}

        {/* Bottom CTA */}
        {review.restaurant_id && (
          <Link
            href={`/restaurants/${review.restaurant_id}`}
            className="flex h-[52px] w-full items-center justify-center gap-1.5 rounded-xl bg-terra text-base font-bold text-white"
          >
            この店舗を見る
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
