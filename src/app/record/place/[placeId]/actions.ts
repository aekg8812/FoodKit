'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateGooglePlaceExists } from '@/lib/places/google'

export type SubmitGooglePlaceReviewResult =
  | { ok: true; restaurantId: string; reviewId: string }
  | { ok: false; error: string }

export async function submitGooglePlaceReviewAction(input: {
  placeId: string
  rating: number
  comment: string
  visitDate: string
  imagePath: string | null
  reasonKeys: string[]
  labelKeys: string[]
}): Promise<SubmitGooglePlaceReviewResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'ログインが必要です。再度ログインしてください' }
  }

  const placeId = input.placeId.trim()
  if (!placeId) {
    return { ok: false, error: 'お店の情報が取得できませんでした。もう一度お試しください' }
  }

  const { rating, comment, visitDate, imagePath, reasonKeys, labelKeys } = input

  if (rating < 1 || rating > 4) {
    return { ok: false, error: '評価を選択してください' }
  }

  const signalParams = {
    p_reason_keys: reasonKeys.length > 0 ? reasonKeys : null,
    p_label_keys:  labelKeys.length > 0  ? labelKeys  : null,
  }

  // Fast path: restaurant already registered
  const { data: existingId } = await supabase.rpc(
    'resolve_restaurant_by_external_place_id',
    { p_external_place_id: placeId },
  )
  if (existingId) {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.rpc('create_google_restaurant_review', {
      p_external_place_id: placeId,
      p_user_id: user.id,
      p_rating: rating,
      p_comment: comment.trim() || null,
      p_visit_date: visitDate || null,
      p_image_path: imagePath || null,
      ...signalParams,
    })
    if (error) {
      return { ok: false, error: '記録の保存に失敗しました。時間をおいて再度お試しください' }
    }
    const result = data as { restaurant_id: string; review_id: string }
    return { ok: true, restaurantId: result.restaurant_id, reviewId: result.review_id }
  }

  // Server-side Google Place ID validation
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

  // Atomic: restaurant resolve/create + review upsert + learning signals
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.rpc('create_google_restaurant_review', {
    p_external_place_id: placeId,
    p_user_id: user.id,
    p_rating: rating,
    p_comment: comment.trim() || null,
    p_visit_date: visitDate || null,
    p_image_path: imagePath || null,
    ...signalParams,
  })

  if (error) {
    return { ok: false, error: '記録の保存に失敗しました。時間をおいて再度お試しください' }
  }

  const result = data as { restaurant_id: string; review_id: string }
  return { ok: true, restaurantId: result.restaurant_id, reviewId: result.review_id }
}
