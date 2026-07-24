import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RestaurantListClient, {
  type RestaurantRow,
  type ReviewRow,
  type ProfileRow,
} from './RestaurantListClient'

export default async function RestaurantsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [restaurantsResult, reviewsResult, profilesResult] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, area, genre, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('reviews').select('restaurant_id, rating, user_id'),
    supabase.from('user_value_profiles').select('user_id, main_value_type'),
  ])

  if (restaurantsResult.error) {
    throw new Error(
      `RestaurantsPage: failed to load restaurants: ${restaurantsResult.error.message}`,
    )
  }
  if (reviewsResult.error) {
    throw new Error(
      `RestaurantsPage: failed to load reviews: ${reviewsResult.error.message}`,
    )
  }
  if (profilesResult.error) {
    throw new Error(
      `RestaurantsPage: failed to load profiles: ${profilesResult.error.message}`,
    )
  }

  const restaurants = (restaurantsResult.data ?? []) as RestaurantRow[]
  const reviews = (reviewsResult.data ?? []) as ReviewRow[]
  const profiles = (profilesResult.data ?? []) as ProfileRow[]

  return (
    <RestaurantListClient
      restaurants={restaurants}
      reviews={reviews}
      profiles={profiles}
      currentUserId={user.id}
    />
  )
}
