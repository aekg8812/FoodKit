import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getUserState } from '@/lib/auth/getUserState'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'
import RestaurantEditForm from './RestaurantEditForm'
import GoogleRestaurantEditForm from './GoogleRestaurantEditForm'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function RestaurantEditPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select(
      'id, name, source, external_place_id, area, genre, address, budget_per_person_max_yen, party_size_tags, atmosphere_tags, walk_in_available, parking_available, main_image_path, created_by',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`RestaurantEditPage: query failed: ${error.message}`)
  if (!restaurant) notFound()

  // Only the creator can edit. Non-owners and seed restaurants (created_by=NULL) redirect.
  if (restaurant.created_by !== user.id) {
    redirect(`/restaurants/${id}`)
  }

  // Generate signed URL for current main image
  let currentImageSignedUrl: string | null = null
  if (restaurant.main_image_path) {
    const { data: signedData } = await supabase.storage
      .from('restaurant-images')
      .createSignedUrl(restaurant.main_image_path, 60 * 60)
    currentImageSignedUrl = signedData?.signedUrl ?? null
  }

  // Google restaurants: image-only edit with readonly Google info display
  if (restaurant.source === 'google_place') {
    const rDisplay = await resolveRestaurantDisplay(restaurant)
    return (
      <GoogleRestaurantEditForm
        restaurantId={restaurant.id}
        displayName={rDisplay.name}
        formattedAddress={rDisplay.address}
        mainImagePath={restaurant.main_image_path}
        currentImageSignedUrl={currentImageSignedUrl}
      />
    )
  }

  return (
    <RestaurantEditForm
      restaurant={{
        id: restaurant.id,
        name: restaurant.name,
        area: restaurant.area,
        genre: restaurant.genre,
        address: restaurant.address,
        budget_per_person_max_yen: restaurant.budget_per_person_max_yen,
        party_size_tags: restaurant.party_size_tags,
        atmosphere_tags: restaurant.atmosphere_tags,
        walk_in_available: restaurant.walk_in_available,
        parking_available: restaurant.parking_available,
        main_image_path: restaurant.main_image_path,
      }}
      currentImageSignedUrl={currentImageSignedUrl}
    />
  )
}
