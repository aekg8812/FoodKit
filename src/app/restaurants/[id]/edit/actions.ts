'use server'

import { createClient } from '@/lib/supabase/server'

export type UpdateGoogleRestaurantImageResult =
  | { ok: true }
  | { ok: false; error: string }

export async function updateGoogleRestaurantImageAction(
  restaurantId: string,
  newImagePath: string | null,
): Promise<UpdateGoogleRestaurantImageResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'ログインが必要です。再度ログインしてください' }
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, created_by, source')
    .eq('id', restaurantId)
    .maybeSingle()

  if (!restaurant) {
    return { ok: false, error: '店舗情報が見つかりませんでした' }
  }
  if (restaurant.source !== 'google_place') {
    return { ok: false, error: '不正なリクエストです' }
  }
  if (restaurant.created_by !== user.id) {
    return { ok: false, error: 'この店舗を編集する権限がありません' }
  }

  const { error: updateError } = await supabase
    .from('restaurants')
    .update({ main_image_path: newImagePath })
    .eq('id', restaurantId)

  if (updateError) {
    return { ok: false, error: '保存に失敗しました。時間をおいて再度お試しください' }
  }

  return { ok: true }
}
