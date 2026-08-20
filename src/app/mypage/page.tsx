import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { redirect } from 'next/navigation'
import MypageClient, {
  type UserRow,
  type ValueProfileRow,
  type MyReviewRow,
  type MyRestaurantRow,
  type GroupRow,
} from './MypageClient'

export default async function MypagePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [userResult, profileResult, myReviewsResult, myRestaurantsResult, groupResult] =
    await Promise.all([
      // username は自分の行のみ参照する（id = auth.uid()）。
      // 他ユーザーの情報は security definer 関数経由でしか読まない。
      supabase.from('users').select('name, email, username').eq('id', user.id).single(),
      supabase
        .from('user_value_profiles')
        .select('main_value_type, confidence, profile_completion')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('reviews')
        .select('id, rating, comment, visit_date, created_at, restaurant_id, restaurants(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('restaurants')
        .select('id, name, area, genre, created_at')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('groups').select('id, name, invite_code').limit(1).maybeSingle(),
    ])

  if (userResult.error) {
    console.error('MypagePage: failed to load user', userResult.error)
    throw new Error(`MypagePage: failed to load user: ${userResult.error.message}`)
  }
  if (profileResult.error) {
    console.error('MypagePage: failed to load profile', profileResult.error)
    throw new Error(`MypagePage: failed to load profile: ${profileResult.error.message}`)
  }
  if (myReviewsResult.error) {
    console.error('MypagePage: failed to load reviews', myReviewsResult.error)
    throw new Error(`MypagePage: failed to load reviews: ${myReviewsResult.error.message}`)
  }
  if (myRestaurantsResult.error) {
    console.error('MypagePage: failed to load restaurants', myRestaurantsResult.error)
    throw new Error(
      `MypagePage: failed to load restaurants: ${myRestaurantsResult.error.message}`,
    )
  }
  if (groupResult.error) {
    console.error('MypagePage: failed to load group', groupResult.error)
    throw new Error(`MypagePage: failed to load group: ${groupResult.error.message}`)
  }

  return (
    <MypageClient
      userData={userResult.data as UserRow}
      profile={profileResult.data as ValueProfileRow | null}
      myReviews={(myReviewsResult.data ?? []) as unknown as MyReviewRow[]}
      myRestaurants={(myRestaurantsResult.data ?? []) as MyRestaurantRow[]}
      group={groupResult.data as GroupRow | null}
    />
  )
}
