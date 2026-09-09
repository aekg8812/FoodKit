import type { SupabaseClient } from '@supabase/supabase-js'

export type CreateRestaurantInput = {
  name: string
  area: string
  genre: string
  address: string
  memo: string
}

export async function createRestaurant(
  supabase: SupabaseClient,
  input: CreateRestaurantInput,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('restaurants')
    .insert({
      name: input.name.trim(),
      area: input.area.trim() || null,
      genre: input.genre.trim() || null,
      address: input.address.trim() || null,
      memo: input.memo.trim() || null,
      created_by: userId,
      source: 'manual',
    })
    .select('id')
    .single()

  if (error) throw error

  return (data as { id: string }).id
}
