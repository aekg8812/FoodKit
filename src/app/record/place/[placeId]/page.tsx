import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import { ensureRestaurantAccesses } from '@/lib/restaurants/access'
import { getGooglePlaceDetails } from '@/lib/places/google'
import GooglePlaceRecordForm from './GooglePlaceRecordForm'

type Props = {
  params: Promise<{ placeId: string }>
}

export default async function RecordPlacePage({ params }: Props) {
  const { placeId: rawPlaceId } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/record/place/[placeId]', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const placeId = rawPlaceId?.trim() ?? ''
  if (!placeId) redirect('/record')

  // Fast path: restaurant already exists
  const { data: existingId } = await supabase.rpc(
    'resolve_restaurant_by_external_place_id',
    { p_external_place_id: placeId },
  )

  if (existingId) {
    await ensureRestaurantAccesses(supabase, existingId as string, user.id)
    redirect(`/record/${existingId}`)
  }

  // Fetch Google Place details for ephemeral display (never stored)
  const details = await getGooglePlaceDetails(placeId)

  return (
    <GooglePlaceRecordForm
      placeId={placeId}
      googleDisplayName={details?.displayName ?? null}
      googleFormattedAddress={details?.formattedAddress ?? null}
    />
  )
}
