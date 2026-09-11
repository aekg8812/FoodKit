import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import ProfileLayout, { type ReviewGridItem } from '@/components/ProfileLayout'
import { createClient } from '@/lib/supabase/server'
import ProfileActions, { type FollowRelationship } from './ProfileActions'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'

type PublicProfileRow = {
  id: string
  username: string
  name: string
  avatar_path: string | null
  updated_at: string | null
}

type PublicValueProfileRow = {
  main_value_type: string | null
}

type FollowRow = {
  follower_id: string
  followee_id: string
}

type ProfileReviewRow = {
  id: string
  rating: number
  restaurant_id: string
  image_path: string | null
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

  const outgoing = follows.some(
    (follow) => follow.follower_id === viewerId && follow.followee_id === profileUserId,
  )
  const incoming = follows.some(
    (follow) => follow.follower_id === profileUserId && follow.followee_id === viewerId,
  )

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
  await logPageAuthRequest('/users/[username]', Boolean(viewer))
  if (!viewer) redirect('/login')

  const { data: profileData, error: profileError } = await supabase
    .from('user_public_profiles')
    .select('id, username, name, avatar_path, updated_at')
    .ilike('username', escapeLikePattern(username))
    .limit(1)
    .maybeSingle()

  if (profileError) {
    console.error('UserProfilePage: failed to load profile', profileError)
    throw new Error('プロフィールを読み込めませんでした。')
  }
  if (!profileData) notFound()

  const profile = profileData as PublicProfileRow
  const isSelf = viewer.id === profile.id

  const valueProfileQuery = supabase
    .from('user_public_value_profiles')
    .select('main_value_type')
    .eq('user_id', profile.id)
    .maybeSingle()
  const friendCountQuery = supabase.rpc('get_friend_count', { p_user_id: profile.id })
  const reviewsQuery = supabase
    .from('reviews')
    .select('id, rating, restaurant_id, image_path, restaurants(id, name)')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  const followsQuery = isSelf
    ? Promise.resolve({ data: [] as FollowRow[], error: null })
    : supabase
        .from('follows')
        .select('follower_id, followee_id')
        .in('follower_id', [viewer.id, profile.id])
        .in('followee_id', [viewer.id, profile.id])
        .eq('status', 'accepted')

  const [valueProfileResult, friendCountResult, reviewsResult, followsResult] =
    await Promise.all([
      valueProfileQuery,
      friendCountQuery,
      reviewsQuery,
      followsQuery,
    ])

  const queryErrors = [
    ['value profile', valueProfileResult.error],
    ['friend count', friendCountResult.error],
    ['reviews', reviewsResult.error],
    ['follow directions', followsResult.error],
  ] as const
  const failedQuery = queryErrors.find(([, error]) => error)

  if (failedQuery) {
    console.error(`UserProfilePage: failed to load ${failedQuery[0]}`, failedQuery[1])
    throw new Error('プロフィールを読み込めませんでした。')
  }

  const reviewRows = (reviewsResult.data ?? []) as unknown as ProfileReviewRow[]
  const imagePaths = [
    ...new Set(
      reviewRows
        .map((review) => review.image_path)
        .filter((path): path is string => Boolean(path)),
    ),
  ]
  const signedImagesResult = imagePaths.length
    ? await supabase.storage.from('review-images').createSignedUrls(imagePaths, 60 * 60)
    : { data: [], error: null }

  if (signedImagesResult.error) {
    console.error('UserProfilePage: failed to sign review images', signedImagesResult.error)
  }

  const signedImageUrls = new Map<string, string | null>()
  for (const signedImage of signedImagesResult.data ?? []) {
    if (signedImage.error) {
      console.error('UserProfilePage: failed to sign review image', {
        path: signedImage.path,
        message: signedImage.error,
      })
    }
    if (signedImage.path) signedImageUrls.set(signedImage.path, signedImage.signedUrl)
  }
  const reviews: ReviewGridItem[] = reviewRows.map((review) => ({
    id: review.id,
    restaurantId: review.restaurant_id,
    restaurantName: review.restaurants?.name ?? '店舗情報なし',
    rating: review.rating,
    imageUrl: review.image_path ? signedImageUrls.get(review.image_path) ?? null : null,
  }))

  const relationship = getRelationship(
    viewer.id,
    profile.id,
    (followsResult.data ?? []) as FollowRow[],
  )
  const valueProfile = valueProfileResult.data as PublicValueProfileRow | null
  const publicAvatarUrl = profile.avatar_path
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null
  const avatarUrl =
    publicAvatarUrl && profile.updated_at
      ? `${publicAvatarUrl}?v=${encodeURIComponent(profile.updated_at)}`
      : publicAvatarUrl
  const emptyMessage =
    relationship === 'self'
      ? 'まだレビューを投稿していません'
      : relationship === 'mutual'
        ? 'まだ記録がありません'
        : 'フォローし合うと記録が見られます'

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <div className="mx-auto mb-5 w-full max-w-md">
        <Link
          href="/friends?tab=friends"
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-ink-sub transition-colors hover:text-ink"
        >
          ← 友人ページに戻る
        </Link>
      </div>

      <ProfileLayout
        user={{
          id: profile.id,
          username: profile.username,
          name: profile.name,
          avatarUrl,
        }}
        friendCount={Number(friendCountResult.data ?? 0)}
        valueType={valueProfile?.main_value_type ?? null}
        actions={
          <ProfileActions
            viewerId={viewer.id}
            profileUserId={profile.id}
            initialRelationship={relationship}
          />
        }
        reviews={reviews}
        emptyMessage={emptyMessage}
      />

      <BottomNav />
    </main>
  )
}
