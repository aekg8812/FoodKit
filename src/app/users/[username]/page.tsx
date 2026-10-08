import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import ReviewCard, { type ReviewCardData } from '@/components/ReviewCard'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import ProfileActions, { type FollowRelationship } from './ProfileActions'

type PublicProfileRow = {
  id: string
  username: string
  name: string
  avatar_path: string | null
  updated_at: string | null
}

type FollowRow = {
  follower_id: string
  followee_id: string
}

type FollowCountsRow = {
  following_count: number
  follower_count: number
}

type PreferenceCardRow = {
  label: string
  description: string | null
  image_path: string | null
  sort_order: number
}

type ReviewRow = {
  id: string
  rating: number
  restaurant_id: string
  image_path: string | null
  comment: string | null
  visit_date: string | null
  created_at: string
  restaurants: { id: string; name: string } | null
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function getRelationship(
  viewerId: string,
  profileUserId: string,
  follows: FollowRow[],
): FollowRelationship {
  if (viewerId === profileUserId) return 'self'
  const outgoing = follows.some((f) => f.follower_id === viewerId && f.followee_id === profileUserId)
  const incoming = follows.some((f) => f.follower_id === profileUserId && f.followee_id === viewerId)
  if (outgoing && incoming) return 'mutual'
  if (outgoing) return 'outgoing'
  if (incoming) return 'incoming'
  return 'none'
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
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

  if (profileError) throw new Error(`UserProfilePage: profile query failed: ${profileError.message}`)
  if (!profileData) notFound()

  const profile = profileData as PublicProfileRow
  const isSelf = viewer.id === profile.id

  const followsQuery = isSelf
    ? Promise.resolve({ data: [] as FollowRow[], error: null })
    : supabase
        .from('follows')
        .select('follower_id, followee_id')
        .in('follower_id', [viewer.id, profile.id])
        .in('followee_id', [viewer.id, profile.id])
        .eq('status', 'accepted')

  const [followCountsResult, prefCardsResult, followsResult, reviewsResult] = await Promise.all([
    supabase.rpc('get_user_follow_counts', { p_user_id: profile.id }),
    supabase.rpc('get_user_preference_cards_public', { p_user_id: profile.id }),
    followsQuery,
    supabase
      .from('reviews')
      .select('id, rating, restaurant_id, image_path, comment, visit_date, created_at, restaurants(id, name)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  if (reviewsResult.error) throw new Error(`UserProfilePage: reviews query failed: ${reviewsResult.error.message}`)
  if (followCountsResult.error) throw new Error(`UserProfilePage: follow counts failed: ${followCountsResult.error.message}`)

  const reviewRows = (reviewsResult.data ?? []) as unknown as ReviewRow[]

  const imagePaths = [
    ...new Set(reviewRows.map((r) => r.image_path).filter((p): p is string => Boolean(p))),
  ]
  const signedImagesResult = imagePaths.length
    ? await supabase.storage.from('review-images').createSignedUrls(imagePaths, 60 * 60)
    : { data: [], error: null }
  const signedImageUrls = new Map<string, string>()
  for (const item of signedImagesResult.data ?? []) {
    if (item.path && !item.error && item.signedUrl) signedImageUrls.set(item.path, item.signedUrl)
  }

  const publicAvatarUrl = profile.avatar_path
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null
  const avatarUrl =
    publicAvatarUrl && profile.updated_at
      ? `${publicAvatarUrl}?v=${encodeURIComponent(profile.updated_at)}`
      : publicAvatarUrl

  const relationship = getRelationship(
    viewer.id,
    profile.id,
    (followsResult.data ?? []) as FollowRow[],
  )

  const followCountsRow = (followCountsResult.data as unknown as FollowCountsRow[] | null)?.[0]
  const followingCount = Number(followCountsRow?.following_count ?? 0)
  const followerCount = Number(followCountsRow?.follower_count ?? 0)

  const prefCards = (prefCardsResult.data ?? []) as PreferenceCardRow[]

  const reviews: ReviewCardData[] = reviewRows.map((row) => ({
    review_id: row.id,
    restaurant_id: row.restaurant_id,
    user_id: profile.id,
    username: profile.username,
    name: profile.name,
    avatar_path: profile.avatar_path,
    avatar_url: avatarUrl,
    rating: row.rating,
    comment: row.comment,
    visit_date: row.visit_date,
    image_path: row.image_path,
    image_url: row.image_path ? (signedImageUrls.get(row.image_path) ?? null) : null,
    created_at: row.created_at,
  }))

  const initial = Array.from((profile.name ?? profile.username ?? '?').trim())[0] ?? '?'

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-2">
        <Suspense>
          <BackButton fallbackHref="/home" label="" />
        </Suspense>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-md">
        {/* Profile hero — centered */}
        <section className="flex flex-col items-center px-5 pt-2 pb-5">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={profile.name ?? profile.username}
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-edge"
              unoptimized
            />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-cream text-2xl font-semibold text-amber-800 ring-2 ring-edge">
              {initial}
            </span>
          )}

          <h1 className="mt-3 text-lg font-bold text-ink">{profile.name ?? profile.username}</h1>
          <p className="text-sm text-ink-sub">@{profile.username}</p>

          {/* Follow counts */}
          <div className="mt-3 flex gap-6 text-sm">
            <span className="flex flex-col items-center">
              <span className="font-bold text-ink">{followingCount}</span>
              <span className="text-xs text-ink-sub">フォロー</span>
            </span>
            <span className="flex flex-col items-center">
              <span className="font-bold text-ink">{followerCount}</span>
              <span className="text-xs text-ink-sub">フォロワー</span>
            </span>
          </div>

          {/* Follow / unfollow button */}
          {!isSelf && (
            <div className="mt-4 w-full max-w-[240px]">
              <ProfileActions
                viewerId={viewer.id}
                profileUserId={profile.id}
                initialRelationship={relationship}
              />
            </div>
          )}
        </section>

        {/* Preference cards */}
        <section className="mx-4 mb-4 rounded-2xl border border-edge bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink">食の好み</h2>
            {prefCards.length > 0 && (
              <Link
                href={`/users/${profile.username}/preferences`}
                className="text-xs text-terra hover:underline"
              >
                すべて見る
              </Link>
            )}
          </div>
          {prefCards.length === 0 ? (
            <p className="text-sm text-ink-sub">まだ好みが設定されていません</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {prefCards.slice(0, 5).map((card) => (
                <span
                  key={card.sort_order}
                  className="rounded-full bg-terra/10 px-3 py-1 text-xs font-medium text-terra"
                >
                  {card.label}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Recent records */}
        <section className="mx-4 rounded-2xl border border-edge bg-surface">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold text-ink">最近の記録</h2>
            {reviews.length > 0 && (
              <Link
                href={`/users/${profile.username}/records`}
                className="text-xs text-terra hover:underline"
              >
                すべて見る
              </Link>
            )}
          </div>
          <div className="space-y-3 px-4 pb-4">
            {reviews.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-sub">まだ記録がありません</p>
            ) : (
              reviews.map((review) => (
                <ReviewCard
                  key={review.review_id}
                  review={review}
                  currentUserId={viewer.id}
                  detailHref={`/records/${review.review_id}`}
                />
              ))
            )}
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  )
}
