'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ensureRestaurantAccesses } from '@/lib/restaurants/access'
import { validateGooglePlaceExists } from '@/lib/places/google'

export type CreateGoogleRestaurantResult =
  | { ok: true; restaurantId: string }
  | { ok: false; error: string }

async function tryEnsureAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  restaurantId: string,
  userId: string,
): Promise<void> {
  try {
    await ensureRestaurantAccesses(supabase, restaurantId, userId)
  } catch {
    // Non-fatal: access row may already exist
  }
}

export async function createGoogleRestaurantForRecordAction(input: {
  placeId: string
  name: string
}): Promise<CreateGoogleRestaurantResult> {
  const supabase = await createClient()

  // Step 1: Auth
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'ログインが必要です。再度ログインしてください' }
  }

  // Step 2: Name validation
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'お店の名前を入力してください' }
  if (name.length > 100) return { ok: false, error: 'お店の名前は100文字以内にしてください' }

  // Step 3: placeId validation
  const placeId = input.placeId.trim()
  if (!placeId) return { ok: false, error: 'お店の情報が取得できませんでした。もう一度お試しください' }

  // Step 4: Pre-resolve — return early if this place is already registered
  const { data: existingId } = await supabase.rpc(
    'resolve_restaurant_by_external_place_id',
    { p_external_place_id: placeId },
  )
  if (existingId) {
    await tryEnsureAccess(supabase, existingId as string, user.id)
    return { ok: true, restaurantId: existingId as string }
  }

  // Step 5: Server-side Google Place ID re-validation
  let placeExists: boolean
  try {
    placeExists = await validateGooglePlaceExists(placeId)
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

  // Step 6: INSERT via service role (bypasses RLS for external_place_id IS NOT NULL)
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('restaurants')
    .insert({
      name,
      external_place_id: placeId,
      source: 'google_place',
      created_by: user.id,
      area: null,
      genre: null,
      address: null,
      main_image_path: null,
    })
    .select('id')
    .single()

  // 23505 = unique_violation: race where another user inserted the same place_id
  if (error?.code === '23505') {
    const { data: racedId } = await supabase.rpc(
      'resolve_restaurant_by_external_place_id',
      { p_external_place_id: placeId },
    )
    if (racedId) {
      await tryEnsureAccess(supabase, racedId as string, user.id)
      return { ok: true, restaurantId: racedId as string }
    }
    return { ok: false, error: '登録中に問題が発生しました。時間をおいて再度お試しください' }
  }

  if (error) {
    return { ok: false, error: '登録に失敗しました。時間をおいて再度お試しください' }
  }

  const restaurantId = (data as { id: string }).id

  // Step 7: Ensure restaurant_accesses using normal authenticated client
  await tryEnsureAccess(supabase, restaurantId, user.id)

  return { ok: true, restaurantId }
}
