import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import ProfileLayout, { type ReviewGridItem } from '@/components/ProfileLayout'
import { createClient } from '@/lib/supabase/server'
import ProfileActions, { type FollowRelationship } from './ProfileActions'

type PublicProfileRow = {
  id: string
  username: string
  name: string
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
  isMutual: boolean,
  follows: FollowRow[],
): FollowRelationship {
  if (viewerId === profileUserId) return 'self'
  if (isMutual) return 'mutual'

  const outgoing = follows.some(
    (follow) => follow.follower_id === viewerId && follow.followee_id === profileUserId,
  )
  const incoming = follows.some(
    (follow) => follow.follower_id === profileUserId && follow.followee_id === viewerId,
  )

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

  const { data: profileData, error: profileError } = await supabase
    .from('user_public_profiles')
    .select('id, username, name')
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

  const relationshipQueries = isSelf
    ? Promise.resolve([
        { data: false, error: null },
        { data: [] as FollowRow[], error: null },
      ] as const)
    : Promise.all([
        supabase.rpc('is_mutual_follow', { p_other_user_id: profile.id }),
        supabase
          .from('follows')
          .select('follower_id, followee_id')
          .in('follower_id', [viewer.id, profile.id])
          .in('followee_id', [viewer.id, profile.id])
          .eq('status', 'accepted'),
      ])

  const [valueProfileResult, friendCountResult, reviewsResult, relationshipResults] =
    await Promise.all([
      valueProfileQuery,
      friendCountQuery,
      reviewsQuery,
      relationshipQueries,
    ])
  const [mutualResult, followsResult] = relationshipResults

  const queryErrors = [
    ['value profile', valueProfileResult.error],
    ['friend count', friendCountResult.error],
    ['reviews', reviewsResult.error],
    ['mutual follow', mutualResult.error],
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
  const signedImageEntries = await Promise.all(
    imagePaths.map(async (path) => {
      const { data, error } = await supabase.storage
        .from('review-images')
        .createSignedUrl(path, 60 * 60)

      if (error) {
        console.error('UserProfilePage: failed to sign review image', {
          path,
          message: error.message,
          statusCode: error.statusCode,
        })
      }

      return [path, data?.signedUrl ?? null] as const
    }),
  )
  const signedImageUrls = new Map(signedImageEntries)
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
    Boolean(mutualResult.data),
    (followsResult.data ?? []) as FollowRow[],
  )
  const valueProfile = valueProfileResult.data as PublicValueProfileRow | null
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
          avatarUrl: null,
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
