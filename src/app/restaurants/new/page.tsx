import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RestaurantNewForm from './RestaurantNewForm'
import { RESTAURANT_AREAS } from '@/lib/restaurants/areas'
import { RESTAURANT_GENRES } from '@/lib/restaurants/genres'
import { ensureRestaurantAccesses } from '@/lib/restaurants/access'

export default async function RestaurantNewPage({
  searchParams,
}: {
  searchParams: Promise<{
    name?: string | string[]
    area?: string | string[]
    genre?: string | string[]
    from?: string | string[]
    external_place_id?: string | string[]
  }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const requestedParams = await searchParams
  const requestedName = requestedParams.name
  const initialName = typeof requestedName === 'string' ? requestedName : ''
  const requestedArea = typeof requestedParams.area === 'string' ? requestedParams.area : ''
  const initialArea = RESTAURANT_AREAS.includes(
    requestedArea as (typeof RESTAURANT_AREAS)[number],
  )
    ? requestedArea
    : ''
  const requestedGenre =
    typeof requestedParams.genre === 'string' ? requestedParams.genre : ''
  const initialGenre = RESTAURANT_GENRES.includes(
    requestedGenre as (typeof RESTAURANT_GENRES)[number],
  )
    ? requestedGenre
    : ''

  const from = typeof requestedParams.from === 'string' ? requestedParams.from : ''
  const successDestination = from === 'record' ? ('record' as const) : ('restaurant' as const)

  // Resolve external_place_id: if an existing restaurant already has this place ID,
  // ensure access and redirect directly (skips the registration form).
  const rawExternalPlaceId =
    typeof requestedParams.external_place_id === 'string'
      ? requestedParams.external_place_id.trim()
      : ''

  if (rawExternalPlaceId) {
    const { data: existingId } = await supabase.rpc(
      'resolve_restaurant_by_external_place_id',
      { p_external_place_id: rawExternalPlaceId },
    )

    if (existingId) {
      await ensureRestaurantAccesses(supabase, existingId as string, user.id)
      redirect(
        successDestination === 'record'
          ? `/record/${existingId}`
          : `/restaurants/${existingId}`,
      )
    }
  }

  return (
    <RestaurantNewForm
      initialName={initialName}
      initialArea={initialArea}
      initialGenre={initialGenre}
      successDestination={successDestination}
      initialExternalPlaceId={rawExternalPlaceId || undefined}
    />
  )
}
