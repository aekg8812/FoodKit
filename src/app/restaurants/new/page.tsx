import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RestaurantNewForm from './RestaurantNewForm'
import { RESTAURANT_AREAS } from '@/lib/restaurants/areas'
import { RESTAURANT_GENRES } from '@/lib/restaurants/genres'

export default async function RestaurantNewPage({
  searchParams,
}: {
  searchParams: Promise<{
    name?: string | string[]
    area?: string | string[]
    genre?: string | string[]
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

  return (
    <RestaurantNewForm
      initialName={initialName}
      initialArea={initialArea}
      initialGenre={initialGenre}
    />
  )
}
