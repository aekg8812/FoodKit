import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import RatingBadge from '@/components/RatingBadge'
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
type ProfileRow    = { id: string; username: string; name: string | null; avatar_path: string | null }

export default async function FollowingRecordsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // followee IDs
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

  const reviews = ((recentReviewsResult.data ?? []) as ReviewRow[])

  const reviewRestaurantIds = [...new Set(reviews.map(r => r.restaurant_id))]
  const reviewAuthorIds     = [...new Set(reviews.map(r => r.user_id))]

  const [restaurantsResult, profilesResult] = await Promise.all([
    reviewRestaurantIds.length > 0
      ? supabase.from('restaurants').select('id, name, area, genre').in('id', reviewRestaurantIds)
      : { data: [] as RestaurantRow[], error: null },
    reviewAuthorIds.length > 0
      ? supabase.from('user_public_profiles').select('id, username, name, avatar_path').in('id', reviewAuthorIds)
      : { data: [] as ProfileRow[], error: null },
  ])

  const restaurantMap = new Map(((restaurantsResult.data ?? []) as RestaurantRow[]).map(r => [r.id, r]))
  const profileMap    = new Map(((profilesResult.data ?? []) as ProfileRow[]).map(p => [p.id, p]))

  const imagePaths = reviews.flatMap(r => r.image_path ? [r.image_path] : [])
  const signedResult = imagePaths.length > 0
    ? await supabase.storage.from('review-images').createSignedUrls(imagePaths, 3600)
    : { data: [], error: null }

  const signedUrlMap = new Map<string, string>()
  for (const s of signedResult.data ?? []) {
    if (s.path && s.signedUrl && !s.error) signedUrlMap.set(s.path, s.signedUrl)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <Suspense>
          <BackButton fallbackHref="/home" label="" />
        </Suspense>
        <h1 className="text-base font-bold text-ink">フォロー中の人の記録</h1>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-md px-4 space-y-4">

        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center">
            <p className="text-sm text-ink-sub">フォロー中の人の記録はまだありません</p>
            {followeeIds.length === 0 && (
              <Link
                href="/mypage/follows/search"
                className="mt-4 inline-flex min-h-10 items-center rounded-full bg-terra px-5 text-sm font-semibold text-white"
              >
                ユーザーを探す
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {reviews.map(review => {
              const restaurant = restaurantMap.get(review.restaurant_id)
              const profile    = profileMap.get(review.user_id)
              const avatarUrl  = profile?.avatar_path
                ? `${supabaseUrl}/storage/v1/object/public/avatars/${profile.avatar_path}`
                : null
              const imageUrl   = review.image_path ? signedUrlMap.get(review.image_path) ?? null : null
              const initial    = Array.from((profile?.name ?? profile?.username ?? '?').trim())[0] ?? '?'

              return (
                <li key={review.id} className="rounded-2xl border border-edge bg-surface p-4 shadow-sm">
                  <div className="flex items-center gap-2">
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
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-sm font-semibold text-amber-800">
                          {initial}
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={profile?.username ? `/users/${profile.username}` : '#'}
                        className="truncate text-sm font-medium text-ink hover:underline"
                      >
                        {profile?.name ?? profile?.username ?? '（名前なし）'}
                      </Link>
                      <p className="text-[10px] text-ink-sub">
                        {new Date(review.created_at).toLocaleDateString('ja-JP', {
                          month: 'short', day: 'numeric',
                        })}
                      </p>
                    </div>
                    <RatingBadge rating={review.rating} />
                  </div>

                  {restaurant && (
                    <Link
                      href={`/restaurants/${review.restaurant_id}`}
                      className="mt-2 block truncate text-sm font-semibold text-terra hover:underline"
                    >
                      {restaurant.name}
                      {restaurant.genre && (
                        <span className="ml-1.5 text-xs font-normal text-ink-sub">{restaurant.genre}</span>
                      )}
                      {restaurant.area && (
                        <span className="ml-1 text-[10px] text-ink-sub">· {restaurant.area}</span>
                      )}
                    </Link>
                  )}

                  {review.comment && (
                    <p className="mt-1 line-clamp-3 text-xs leading-5 text-ink-sub">{review.comment}</p>
                  )}

                  {imageUrl && (
                    <div className="mt-2 overflow-hidden rounded-xl">
                      <Image
                        src={imageUrl}
                        alt="記録の写真"
                        width={400}
                        height={220}
                        className="h-40 w-full object-cover"
                        unoptimized
                      />
                    </div>
                  )}

                  <Link
                    href={`/records/${review.id}`}
                    className="mt-2 block text-xs text-terra hover:underline"
                  >
                    記録の詳細を見る →
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
