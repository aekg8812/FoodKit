import 'server-only'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

const LOCATION_BIAS_CENTER = { latitude: 33.6427, longitude: 130.6909 }
const LOCATION_BIAS_RADIUS_METERS = 30000
const MAX_RESULT_COUNT = 8
const SEARCH_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress'
const VALIDATE_FIELD_MASK = 'id'
const PLACES_API_BASE = 'https://places.googleapis.com/v1'
const FETCH_TIMEOUT_MS = 5000

export type GooglePlace = {
  id: string
  displayName: string
  formattedAddress: string | null
}

type PlacesSearchResponse = {
  places?: Array<{
    id: string
    displayName?: { text: string }
    formattedAddress?: string
  }>
}

export async function searchGooglePlaces(query: string): Promise<GooglePlace[]> {
  if (!GOOGLE_PLACES_API_KEY) return []
  if (query.trim().length < 2) return []

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(`${PLACES_API_BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: MAX_RESULT_COUNT,
        languageCode: 'ja',
        regionCode: 'JP',
        locationBias: {
          circle: {
            center: LOCATION_BIAS_CENTER,
            radius: LOCATION_BIAS_RADIUS_METERS,
          },
        },
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) return []

    const json = (await res.json()) as PlacesSearchResponse
    return (json.places ?? []).map((p) => ({
      id: p.id,
      displayName: p.displayName?.text ?? '',
      formattedAddress: p.formattedAddress ?? null,
    }))
  } catch {
    return []
  }
}

export async function validateGooglePlaceExists(placeId: string): Promise<boolean> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY is not configured')
  }
  if (!placeId.trim()) return false

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(
      `${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': VALIDATE_FIELD_MASK,
        },
        signal: controller.signal,
      },
    )
    clearTimeout(timer)

    return res.ok
  } catch {
    return false
  }
}
