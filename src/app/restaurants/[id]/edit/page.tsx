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
      'id, name, source, created_by, area, genre, address, budget_per_person_max_yen, party_size_tags, atmosphere_tags, walk_in_available, parking_available',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`RestaurantEditPage: query failed: ${error.message}`)
  if (!restaurant) notFound()

  // Only the creator can edit metadata. Non-owners and seed restaurants redirect.
  if (restaurant.created_by !== user.id) {
    redirect(`/restaurants/${id}`)
  }

  // Google restaurants have no editable metadata — redirect to image page.
  if (restaurant.source === 'google_place') {
    redirect(`/restaurants/${id}/image`)
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
      }}
    />
  )
}
