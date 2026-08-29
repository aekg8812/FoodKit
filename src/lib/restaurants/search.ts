import type { SupabaseClient } from '@supabase/supabase-js'

export type RestaurantSearchResult = {
  id: string
  name: string
  area: string | null
  genre: string | null
  address: string | null
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
  query: string,
): Promise<RestaurantSearchResult[]> {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return []

  const escapedQuery = escapeLikePattern(normalizedQuery)
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, area, genre, address')
    .ilike('name', `%${escapedQuery}%`)
    .order('name')

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
