import type { createClient } from '@/lib/supabase/client'

export type GooglePlaceResolution = {
  restaurantId: string
  imageUrl: string | null
}

type ResolvedRow = {
  external_place_id: string
  restaurant_id: string
  main_image_path: string | null
}

// Batch-resolves Google Place IDs to FoodKit restaurant rows.
// Returns a map of placeId → { restaurantId, imageUrl }.
// Place IDs absent from the map are Google-only (not yet in FoodKit).
export async function resolveGooglePlaceIds(
  placeIds: string[],
  supabase: ReturnType<typeof createClient>,
): Promise<Map<string, GooglePlaceResolution>> {
  if (placeIds.length === 0) return new Map()

  let resolved: ResolvedRow[] = []
  try {
    const { data } = await supabase.rpc('resolve_restaurants_by_external_place_ids', {
      p_external_place_ids: placeIds,
    })
    resolved = (data as ResolvedRow[]) ?? []
  } catch {
    return new Map()
  }

  const imagePaths = resolved
    .map((r) => r.main_image_path)
    .filter((p): p is string => Boolean(p))

  const signedUrlMap = new Map<string, string>()
  if (imagePaths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from('restaurant-images')
      .createSignedUrls(imagePaths, 3600)
    for (const s of signedData ?? []) {
      if (s.path && s.signedUrl && !s.error) signedUrlMap.set(s.path, s.signedUrl)
    }
  }

  const result = new Map<string, GooglePlaceResolution>()
  for (const r of resolved) {
    result.set(r.external_place_id, {
      restaurantId: r.restaurant_id,
      imageUrl: r.main_image_path ? (signedUrlMap.get(r.main_image_path) ?? null) : null,
    })
  }
  return result
}
