import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getUserState } from '@/lib/auth/getUserState'
import RestaurantEditForm from './RestaurantEditForm'

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
      'id, name, source, area, genre, address, budget_per_person_max_yen, party_size_tags, atmosphere_tags, walk_in_available, parking_available, main_image_path, created_by',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`RestaurantEditPage: query failed: ${error.message}`)
  if (!restaurant) notFound()

  // Google restaurants are not editable — displayName/address come from runtime fetch.
  if (restaurant.source === 'google_place') {
    redirect(`/restaurants/${id}`)
  }

  // Only the creator can edit. Seed restaurants (created_by=NULL) redirect non-owners.
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
