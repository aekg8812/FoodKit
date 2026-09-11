import BottomNav from '@/components/BottomNav'
import ProfileLayout, { type ReviewGridItem } from '@/components/ProfileLayout'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileActions from '../users/[username]/ProfileActions'

type PublicProfileRow = {
  id: string
  username: string
  name: string
  avatar_path: string | null
  updated_at: string | null
}

type ValueProfileRow = {
  main_value_type: string | null
}

type ProfileReviewRow = {
  id: string
  rating: number
  restaurant_id: string
  image_path: string | null
  restaurants: { id: string; name: string } | null
}

function logQueryError(label: string, error: unknown) {
  const details = error as {
    message?: string
    code?: string
    details?: string
    hint?: string
  }

  console.error(`MypagePage: failed to load ${label}`, {
    message: details.message,
    code: details.code,
    details: details.details,
    hint: details.hint,
  })
}

export default async function MypagePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [profileResult, friendCountResult, valueTypeResult, reviewsResult] =
    await Promise.all([
      supabase
        .from('user_public_profiles')
        .select('id, username, name, avatar_path, updated_at')
        .eq('id', user.id)
        .single(),
      supabase.rpc('get_friend_count', { p_user_id: user.id }),
      supabase
        .from('user_value_profiles')
        .select('main_value_type')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('reviews')
        .select('id, rating, restaurant_id, image_path, restaurants(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

  const queryErrors = [
    ['profile', profileResult.error],
    ['friend count', friendCountResult.error],
    ['value type', valueTypeResult.error],
    ['reviews', reviewsResult.error],
  ] as const
  const failedQuery = queryErrors.find(([, error]) => error)

  if (failedQuery) {
    logQueryError(failedQuery[0], failedQuery[1])
    throw new Error('マイページを読み込めませんでした。')
  }

  const profile = profileResult.data as PublicProfileRow
  const valueProfile = valueTypeResult.data as ValueProfileRow | null
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
    logQueryError('review images', signedImagesResult.error)
  }

  const signedImageUrls = new Map<string, string | null>()
  for (const signedImage of signedImagesResult.data ?? []) {
    if (signedImage.error) {
      console.error('MypagePage: failed to sign review image', {
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
  const publicAvatarUrl = profile.avatar_path
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null
  const avatarUrl =
    publicAvatarUrl && profile.updated_at
      ? `${publicAvatarUrl}?v=${encodeURIComponent(profile.updated_at)}`
      : publicAvatarUrl

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
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
            viewerId={user.id}
            profileUserId={user.id}
            initialRelationship="self"
            isOwnMypage
          />
        }
        reviews={reviews}
        emptyMessage="まだ記録がありません"
      />

      <BottomNav />
    </main>
  )
}
