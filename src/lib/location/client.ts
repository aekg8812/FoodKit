'use client'

export const GEO_CACHE_KEY = 'foodkit_geo_cache'
export const GEO_CACHE_TTL_MS = 15 * 60 * 1000

export type CachedLocation = {
  lat: number
  lng: number
  ts: number
}

function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function readCachedLocation(): CachedLocation | null {
  try {
    const raw = sessionStorage.getItem(GEO_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedLocation
    if (Date.now() - parsed.ts > GEO_CACHE_TTL_MS) {
      sessionStorage.removeItem(GEO_CACHE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeCachedLocation(lat: number, lng: number): CachedLocation {
  const entry: CachedLocation = {
    lat: roundCoord(lat),
    lng: roundCoord(lng),
    ts: Date.now(),
  }
  try {
    sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(entry))
  } catch {
    // sessionStorage unavailable (private browsing, storage full, etc.)
  }
  return entry
}

export function requestCurrentLocation(): Promise<CachedLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const cached = writeCachedLocation(pos.coords.latitude, pos.coords.longitude)
        resolve(cached)
      },
      (err) => reject(err),
      { timeout: 10000, maximumAge: 60000 },
    )
  })
}
