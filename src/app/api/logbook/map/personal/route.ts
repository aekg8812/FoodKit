import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGooglePlaceLocation } from '@/lib/places/google'
import { getGooglePlaceDetails } from '@/lib/places/google'
import type { MapPin, MapPersonalStats } from '@/app/logbook/types'

type RestaurantRow = {
  id: string
  name: string | null
  source: string
  external_place_id: string | null
  lat: number | null
  lng: number | null
  address: string | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Aggregate visits per restaurant
  const { data: visitRows, error: visitErr } = await supabase
    .from('restaurant_visits')
    .select('restaurant_id, rating, image_path, visit_date, created_at')
    .eq('user_id', user.id)
    .order('visit_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (visitErr) {
    return NextResponse.json({ error: visitErr.message }, { status: 500 })
  }

  if (!visitRows || visitRows.length === 0) {
    return NextResponse.json({
      pins: [],
      stats: { uniqueRestaurantCount: 0, totalVisitCount: 0, activeMonthCount: 0 },
    })
  }

  // Aggregate per restaurant
  const aggMap = new Map<string, {
    visitCount: number
    latestRating: number
    latestImagePath: string | null
    months: Set<string>
  }>()
  for (const row of visitRows) {
    const agg = aggMap.get(row.restaurant_id)
    const monthKey = row.visit_date ? row.visit_date.substring(0, 7) : null
    if (agg) {
      agg.visitCount++
      if (!agg.latestImagePath && row.image_path) agg.latestImagePath = row.image_path
      if (monthKey) agg.months.add(monthKey)
    } else {
      const months = new Set<string>()
      if (monthKey) months.add(monthKey)
      aggMap.set(row.restaurant_id, {
        visitCount: 1,
        latestRating: row.rating as number,
        latestImagePath: row.image_path,
        months,
      })
    }
  }

  const restaurantIds = [...aggMap.keys()]

  // Fetch restaurant details
  const { data: restaurants, error: restErr } = await supabase
    .from('restaurants')
    .select('id, name, source, external_place_id, lat, lng, address')
    .in('id', restaurantIds)

  if (restErr) {
    return NextResponse.json({ error: restErr.message }, { status: 500 })
  }

  const restMap = new Map<string, RestaurantRow>()
  for (const r of (restaurants ?? []) as RestaurantRow[]) {
    restMap.set(r.id, r)
  }

  // Resolve coords + display names for google_place restaurants
  const googlePlaceIds = (restaurants ?? [])
    .filter((r) => (r as RestaurantRow).source === 'google_place' && (r as RestaurantRow).external_place_id)
    .map((r) => (r as RestaurantRow).external_place_id!)

  const [locationResults, nameResults] = await Promise.all([
    Promise.all(googlePlaceIds.map((pid) => getGooglePlaceLocation(pid).then((loc) => ({ pid, loc })))),
    Promise.all(googlePlaceIds.map((pid) => getGooglePlaceDetails(pid).then((d) => ({ pid, d })))),
  ])

  const locationMap = new Map(locationResults.map(({ pid, loc }) => [pid, loc]))
  const nameMap = new Map(nameResults.map(({ pid, d }) => [pid, d]))

  // Sign image URLs
  const imagePathsToSign: string[] = []
  for (const agg of aggMap.values()) {
    if (agg.latestImagePath) imagePathsToSign.push(agg.latestImagePath)
  }

  const signedUrls = new Map<string, string>()
  for (const path of imagePathsToSign) {
    const { data } = await supabase.storage
      .from('review-images')
      .createSignedUrl(path, 3600)
    if (data?.signedUrl) signedUrls.set(path, data.signedUrl)
  }

  // Build pins
  const pins: MapPin[] = []
  for (const [restaurantId, agg] of aggMap) {
    const r = restMap.get(restaurantId)
    if (!r) continue

    let lat: number | null = r.lat
    let lng: number | null = r.lng
    let name = r.name ?? ''

    if (r.source === 'google_place' && r.external_place_id) {
      const loc = locationMap.get(r.external_place_id)
      if (loc) { lat = loc.lat; lng = loc.lng }
      const details = nameMap.get(r.external_place_id)
      if (details?.displayName) name = details.displayName
    }

    const imagePath = agg.latestImagePath
    const imageUrl = imagePath ? (signedUrls.get(imagePath) ?? null) : null

    pins.push({
      restaurantId,
      name: name || '店舗名未設定',
      lat,
      lng,
      hasLocation: lat !== null && lng !== null,
      visitCount: agg.visitCount,
      latestRating: (agg.latestRating as 1 | 2 | 3 | 4),
      source: r.source,
      externalPlaceId: r.external_place_id,
      latestImageSigned: imageUrl,
      address: r.address,
    })
  }

  // Compute active months across all visits
  const allMonths = new Set<string>()
  for (const agg of aggMap.values()) {
    for (const m of agg.months) allMonths.add(m)
  }

  const stats: MapPersonalStats = {
    uniqueRestaurantCount: pins.length,
    totalVisitCount: visitRows.length,
    activeMonthCount: allMonths.size,
  }

  return NextResponse.json({ pins, stats })
}
