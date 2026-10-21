import 'server-only'
import { cache } from 'react'
import { getGooglePlaceDetails } from '@/lib/places/google'

export type RestaurantDisplayInfo = {
  name: string
  address: string | null
  isGoogle: boolean
}

const fetchGoogleDetails = cache(getGooglePlaceDetails)

export async function resolveRestaurantDisplay(restaurant: {
  name: string | null
  source: string
  external_place_id: string | null
}): Promise<RestaurantDisplayInfo> {
  if (restaurant.source === 'google_place' && restaurant.external_place_id) {
    const details = await fetchGoogleDetails(restaurant.external_place_id)
    return {
      name: details?.displayName ?? 'Google登録店舗',
      address: details?.formattedAddress ?? null,
      isGoogle: true,
    }
  }
  return {
    name: restaurant.name ?? '—',
    address: null,
    isGoogle: false,
  }
}
