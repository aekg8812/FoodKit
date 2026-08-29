import type { SupabaseClient } from '@supabase/supabase-js'

export async function ensurePrivateRestaurantAccess(
  supabase: SupabaseClient,
  restaurantId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('restaurant_accesses').insert({
    restaurant_id: restaurantId,
    visibility: 'private',
    user_id: userId,
    group_id: null,
    created_by: userId,
  })

  // 部分 UNIQUE index により、既存行または同時操作との競合は成功扱いにできる。
  if (error && error.code !== '23505') throw error
}

export async function ensureGroupRestaurantAccesses(
  supabase: SupabaseClient,
  restaurantId: string,
  userId: string,
): Promise<void> {
  const { data: memberships, error: membershipError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)

  if (membershipError) throw membershipError

  const groupIds = [
    ...new Set((memberships ?? []).map((membership) => membership.group_id as string)),
  ]
  if (groupIds.length === 0) return

  const { data: existingRows, error: existingRowsError } = await supabase
    .from('restaurant_accesses')
    .select('group_id')
    .eq('restaurant_id', restaurantId)
    .eq('visibility', 'group')
    .in('group_id', groupIds)

  if (existingRowsError) throw existingRowsError

  const existingGroupIds = new Set(
    (existingRows ?? [])
      .map((access) => access.group_id as string | null)
      .filter((groupId): groupId is string => groupId !== null),
  )
  const missingGroupIds = groupIds.filter((groupId) => !existingGroupIds.has(groupId))
  if (missingGroupIds.length === 0) return

  const { error: insertError } = await supabase.from('restaurant_accesses').insert(
    missingGroupIds.map((groupId) => ({
      restaurant_id: restaurantId,
      visibility: 'group',
      user_id: null,
      group_id: groupId,
      created_by: userId,
    })),
  )

  // 同時操作で同じgroup行が先に作られた場合は成功扱いにする。
  if (insertError && insertError.code !== '23505') throw insertError
}

export async function ensureRestaurantAccesses(
  supabase: SupabaseClient,
  restaurantId: string,
  userId: string,
): Promise<void> {
  await ensurePrivateRestaurantAccess(supabase, restaurantId, userId)
  await ensureGroupRestaurantAccesses(supabase, restaurantId, userId)
}
