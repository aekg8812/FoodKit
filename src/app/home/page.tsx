import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { redirect } from 'next/navigation'
import HomeClient, {
  type UserRow,
  type ValueProfileRow,
  type MyReviewRow,
  type MyRestaurantRow,
  type GroupRow,
  type MemberRow,
  type MemberProfileRow,
} from './HomeClient'

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase)
  if (state === 'no_group') redirect('/groups/join')
  if (state === 'no_onboarding') redirect('/onboarding')

  const [
    userResult,
    profileResult,
    myReviewsResult,
    myRestaurantsResult,
    groupResult,
    membersResult,
    memberProfilesResult,
  ] = await Promise.all([
    supabase.from('users').select('name, email').eq('id', user.id).single(),
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
    supabase.from('group_members').select('user_id, role, users(id, name)'),
    supabase.from('user_value_profiles').select('user_id, main_value_type'),
  ])

  if (userResult.error) {
    console.error('HomePage: failed to load user', userResult.error)
    throw new Error(`HomePage: failed to load user: ${userResult.error.message}`)
  }
  if (profileResult.error) {
    console.error('HomePage: failed to load profile', profileResult.error)
    throw new Error(`HomePage: failed to load profile: ${profileResult.error.message}`)
  }
  if (myReviewsResult.error) {
    console.error('HomePage: failed to load reviews', myReviewsResult.error)
    throw new Error(`HomePage: failed to load reviews: ${myReviewsResult.error.message}`)
  }
  if (myRestaurantsResult.error) {
    console.error('HomePage: failed to load restaurants', myRestaurantsResult.error)
    throw new Error(`HomePage: failed to load restaurants: ${myRestaurantsResult.error.message}`)
  }
  if (groupResult.error) {
    console.error('HomePage: failed to load group', groupResult.error)
    throw new Error(`HomePage: failed to load group: ${groupResult.error.message}`)
  }
  if (membersResult.error) {
    console.error('HomePage: failed to load members', membersResult.error)
    throw new Error(`HomePage: failed to load members: ${membersResult.error.message}`)
  }
  if (memberProfilesResult.error) {
    console.error('HomePage: failed to load member profiles', memberProfilesResult.error)
    throw new Error(
      `HomePage: failed to load member profiles: ${memberProfilesResult.error.message}`,
    )
  }

  return (
    <HomeClient
      currentUserId={user.id}
      userData={userResult.data as UserRow}
      profile={profileResult.data as ValueProfileRow | null}
      myReviews={(myReviewsResult.data ?? []) as unknown as MyReviewRow[]}
      myRestaurants={(myRestaurantsResult.data ?? []) as MyRestaurantRow[]}
      group={groupResult.data as GroupRow | null}
      members={(membersResult.data ?? []) as unknown as MemberRow[]}
      memberProfiles={(memberProfilesResult.data ?? []) as MemberProfileRow[]}
    />
  )
}
