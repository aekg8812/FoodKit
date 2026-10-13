import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import { ensureRestaurantAccesses } from '@/lib/restaurants/access'
import { getGooglePlaceDisplayName } from '@/lib/places/google'
import PlaceConfirmClient from './PlaceConfirmClient'

type Props = {
  params: Promise<{ placeId: string }>
  searchParams: Promise<{ name?: string | string[] }>
}

export default async function RecordPlacePage({ params, searchParams }: Props) {
  const { placeId: rawPlaceId } = await params
  const sp = await searchParams

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/record/place/[placeId]', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // Validate placeId from URL
  const placeId = rawPlaceId?.trim() ?? ''
  if (!placeId) redirect('/record')

  // Resolve existing restaurant — if found, go directly to record flow
  const { data: existingId } = await supabase.rpc(
    'resolve_restaurant_by_external_place_id',
    { p_external_place_id: placeId },
  )

  if (existingId) {
    await ensureRestaurantAccesses(supabase, existingId as string, user.id)
    redirect(`/record/${existingId}`)
  }

  // Not registered yet — fetch displayName for ephemeral hint (never stored)
  const googleHint = await getGooglePlaceDisplayName(placeId)

  // Initial name from userQuery (search term typed by user — user's own data, not Google)
  const rawName = Array.isArray(sp.name) ? sp.name[0] : sp.name
  const initialName = rawName?.trim().slice(0, 100) ?? ''

  return (
    <PlaceConfirmClient
      placeId={placeId}
      googleHint={googleHint}
      initialName={initialName}
    />
  )
}
