import 'server-only'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'
import type { VisitCard } from './types'

type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

type RawVisit = {
  id: string
  restaurant_id: string
  visit_date: string | null
  rating: number
  comment: string | null
  image_path: string | null
  reason_keys: string[]
  label_keys: string[]
  created_at: string
}

type RestaurantRow = {
  id: string
  name: string | null
  source: string
  external_place_id: string | null
  genre: string | null
  area: string | null
  main_image_path: string | null
}

export async function buildVisitCards(
  supabase: SupabaseClient,
  rawVisits: RawVisit[],
): Promise<VisitCard[]> {
  if (rawVisits.length === 0) return []

  // Fetch restaurant details
  const restaurantIds = [...new Set(rawVisits.map(v => v.restaurant_id))]
  const { data: restaurantRows } = await supabase
    .from('restaurants')
    .select('id, name, source, external_place_id, genre, area, main_image_path')
    .in('id', restaurantIds)
  const restaurantMap = new Map<string, RestaurantRow>(
    (restaurantRows ?? []).map(r => [r.id, r as RestaurantRow]),
  )

  // Collect image paths for signing
  const visitImagePaths = rawVisits
    .map(v => v.image_path)
    .filter((p): p is string => Boolean(p))
  const restaurantImagePaths = restaurantIds
    .map(id => restaurantMap.get(id)?.main_image_path)
    .filter((p): p is string => Boolean(p))

  const signedVisitUrls = new Map<string, string>()
  if (visitImagePaths.length > 0) {
    const { data } = await supabase.storage
      .from('review-images')
      .createSignedUrls([...new Set(visitImagePaths)], 3600)
    for (const s of data ?? []) {
      if (s.path && s.signedUrl) signedVisitUrls.set(s.path, s.signedUrl)
    }
  }

  const signedRestaurantUrls = new Map<string, string>()
  if (restaurantImagePaths.length > 0) {
    const { data } = await supabase.storage
      .from('restaurant-images')
      .createSignedUrls([...new Set(restaurantImagePaths)], 3600)
    for (const s of data ?? []) {
      if (s.path && s.signedUrl && !s.error) signedRestaurantUrls.set(s.path, s.signedUrl)
    }
  }

  // Resolve display names for Google Place restaurants
  const displayNames = new Map<string, string>()
  const googleRestaurants = [...restaurantMap.values()].filter(
    r => r.source === 'google_place' && r.external_place_id,
  )
  await Promise.all(
    googleRestaurants.map(async r => {
      const d = await resolveRestaurantDisplay(r)
      displayNames.set(r.id, d.name)
    }),
  )

  return rawVisits.map(v => {
    const r = restaurantMap.get(v.restaurant_id)
    const visitImgUrl = v.image_path ? (signedVisitUrls.get(v.image_path) ?? null) : null
    const restaurantImgUrl = r?.main_image_path
      ? (signedRestaurantUrls.get(r.main_image_path) ?? null)
      : null
    return {
      id: v.id,
      restaurantId: v.restaurant_id,
      visitDate: v.visit_date,
      rating: v.rating as 1 | 2 | 3 | 4,
      comment: v.comment,
      imageUrl: visitImgUrl ?? restaurantImgUrl,
      reasonKeys: v.reason_keys,
      labelKeys: v.label_keys,
      createdAt: v.created_at,
      restaurantName: r
        ? (displayNames.get(r.id) ?? r.name ?? '不明な店舗')
        : '不明な店舗',
      restaurantSource: r?.source ?? 'manual',
      restaurantGenre: r?.genre ?? null,
      restaurantArea: r?.area ?? null,
    } satisfies VisitCard
  })
}
