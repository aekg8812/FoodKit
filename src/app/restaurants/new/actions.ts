'use server'

import { createClient } from '@/lib/supabase/server'
import { ensureRestaurantAccesses } from '@/lib/restaurants/access'
import { validateGooglePlaceExists } from '@/lib/places/google'

export type CreateRestaurantActionInput = {
  name: string
  area: string
  genre: string
  address: string
  memo: string
  externalPlaceId: string
}

export type CreateRestaurantActionResult =
  | { ok: true; restaurantId: string; isExisting: boolean }
  | { ok: false; error: string }

async function tryEnsureAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  restaurantId: string,
  userId: string,
): Promise<void> {
  try {
    await ensureRestaurantAccesses(supabase, restaurantId, userId)
  } catch {
    // Non-fatal: access may already exist or partial failure
  }
}

export async function createRestaurantAction(
  input: CreateRestaurantActionInput,
): Promise<CreateRestaurantActionResult> {
  const supabase = await createClient()

  // Step 1: Auth
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'ログインが必要です。再度ログインしてください' }
  }

  // Step 2: Form validation
  const name = input.name.trim()
  if (!name) return { ok: false, error: '店名を入力してください' }

  const externalPlaceId = input.externalPlaceId.trim()

  if (externalPlaceId) {
    // Step 3: Check if this external_place_id is already registered
    const { data: existingId } = await supabase.rpc(
      'resolve_restaurant_by_external_place_id',
      { p_external_place_id: externalPlaceId },
    )
    if (existingId) {
      await tryEnsureAccess(supabase, existingId as string, user.id)
      return { ok: true, restaurantId: existingId as string, isExisting: true }
    }

    // Step 4: Server-side Google Place ID validation (prevents URL/field tampering)
    let placeExists: boolean
    try {
      placeExists = await validateGooglePlaceExists(externalPlaceId)
    } catch {
      return {
        ok: false,
        error: 'Google Placesの確認に失敗しました。しばらくしてから再度お試しください',
      }
    }
    if (!placeExists) {
      return {
        ok: false,
        error: '指定されたお店の情報を確認できませんでした。もう一度お店を選択してください',
      }
    }
  }

  // Step 5: INSERT (user session client — INSERT RLS applies)
  const { data, error } = await supabase
    .from('restaurants')
    .insert({
      name,
      area: input.area.trim() || null,
      genre: input.genre.trim() || null,
      address: input.address.trim() || null,
      memo: input.memo.trim() || null,
      created_by: user.id,
      source: 'manual',
      external_place_id: externalPlaceId || null,
    })
    .select('id')
    .single()

  // 23505 = unique_violation: race condition where another user inserted the same
  // external_place_id between our resolve check and this INSERT
  if (error?.code === '23505' && externalPlaceId) {
    const { data: racedId } = await supabase.rpc(
      'resolve_restaurant_by_external_place_id',
      { p_external_place_id: externalPlaceId },
    )
    if (racedId) {
      await tryEnsureAccess(supabase, racedId as string, user.id)
      return { ok: true, restaurantId: racedId as string, isExisting: true }
    }
    return {
      ok: false,
      error: '登録中に問題が発生しました。時間をおいて再度お試しください',
    }
  }

  if (error) {
    return { ok: false, error: '登録に失敗しました。時間をおいて再度お試しください' }
  }

  const restaurantId = (data as { id: string }).id

  // Step 6: Ensure restaurant_accesses for the new restaurant
  await tryEnsureAccess(supabase, restaurantId, user.id)

  return { ok: true, restaurantId, isExisting: false }
}
