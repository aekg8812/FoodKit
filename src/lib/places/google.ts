import 'server-only'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

const IIZUKA_CENTER = { latitude: 33.6427, longitude: 130.6909 }
const USER_LOCATION_RADIUS_METERS = 10000
const IIZUKA_FALLBACK_RADIUS_METERS = 30000
const MAX_RESULT_COUNT = 8
const SEARCH_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress'
const VALIDATE_FIELD_MASK = 'id'
const DISPLAY_NAME_FIELD_MASK = 'displayName'
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

export async function searchGooglePlaces(
  query: string,
  userLat?: number,
  userLng?: number,
): Promise<GooglePlace[]> {
  if (!GOOGLE_PLACES_API_KEY) return []
  if (query.trim().length < 2) return []

  const hasUserCoords =
    userLat !== undefined &&
    userLng !== undefined &&
    Number.isFinite(userLat) &&
    Number.isFinite(userLng) &&
    userLat >= -90 &&
    userLat <= 90 &&
    userLng >= -180 &&
    userLng <= 180

  const center = hasUserCoords
    ? { latitude: userLat!, longitude: userLng! }
    : IIZUKA_CENTER
  const radius = hasUserCoords ? USER_LOCATION_RADIUS_METERS : IIZUKA_FALLBACK_RADIUS_METERS

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
            center,
            radius,
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

export async function getGooglePlaceDisplayName(placeId: string): Promise<string | null> {
  if (!GOOGLE_PLACES_API_KEY) return null
  if (!placeId.trim()) return null

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(
      `${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': DISPLAY_NAME_FIELD_MASK,
        },
        cache: 'no-store',
        signal: controller.signal,
      },
    )
    clearTimeout(timer)

    if (!res.ok) return null

    const json = (await res.json()) as { displayName?: { text?: string } }
    return json.displayName?.text ?? null
  } catch {
    return null
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
