import type { SupabaseClient } from '@supabase/supabase-js'

export type FollowMutationResult =
  | { ok: true }
  | { ok: false; message: string }

const FOLLOW_ERROR_MESSAGE = 'フォロー操作に失敗しました。もう一度お試しください。'

export async function followUser(
  supabase: SupabaseClient,
  followerId: string,
  followeeId: string,
): Promise<FollowMutationResult> {
  const { error } = await supabase.from('follows').insert({
    follower_id: followerId,
    followee_id: followeeId,
    status: 'accepted',
  })

  // 画面更新と操作が競合して既に行がある場合も、目的の状態には到達している。
  if (error?.code === '23505') return { ok: true }

  if (error) {
    console.error('followUser failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return { ok: false, message: FOLLOW_ERROR_MESSAGE }
  }

  return { ok: true }
}

export async function unfollowUser(
  supabase: SupabaseClient,
  followerId: string,
  followeeId: string,
): Promise<FollowMutationResult> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)

  if (error) {
    console.error('unfollowUser failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return { ok: false, message: FOLLOW_ERROR_MESSAGE }
  }

  return { ok: true }
}
