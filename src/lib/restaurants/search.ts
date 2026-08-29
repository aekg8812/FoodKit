import type { SupabaseClient } from '@supabase/supabase-js'

export type RestaurantSearchResult = {
  id: string
  name: string
  area: string | null
  genre: string | null
  address: string | null
}

export type RestaurantSearchFilters = {
  query?: string
  area?: string
  genre?: string
}

/**
 * PostgREST の LIKE パターンで特別扱いされる文字を、入力文字として検索する。
 * バックスラッシュを最初に処理しないと、後続の置換で二重エスケープになる。
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export async function searchRestaurants(
  supabase: SupabaseClient,
  filters: RestaurantSearchFilters,
): Promise<RestaurantSearchResult[]> {
  const normalizedQuery = filters.query?.trim() ?? ''
  const area = filters.area?.trim() ?? ''
  const genre = filters.genre?.trim() ?? ''
  if (!normalizedQuery && !area && !genre) return []

  let request = supabase
    .from('restaurants')
    .select('id, name, area, genre, address')
    .order('name')

  if (normalizedQuery) {
    request = request.ilike('name', `%${escapeLikePattern(normalizedQuery)}%`)
  }
  if (area) request = request.eq('area', area)
  if (genre) request = request.eq('genre', genre)

  const { data, error } = await request

  if (error) throw error

  return (data ?? []) as RestaurantSearchResult[]
}

export async function findDuplicateRestaurantCandidates(
  supabase: SupabaseClient,
  name: string,
  area: string,
): Promise<RestaurantSearchResult[]> {
  const normalizedName = name.trim()
  if (!normalizedName) return []

  let request = supabase
    .from('restaurants')
    .select('id, name, area, genre, address')
    .ilike('name', `%${escapeLikePattern(normalizedName)}%`)
    .order('name')
    .limit(5)

  const normalizedArea = area.trim()
  if (normalizedArea) request = request.eq('area', normalizedArea)

  const { data, error } = await request
  if (error) throw error

  return (data ?? []) as RestaurantSearchResult[]
}
