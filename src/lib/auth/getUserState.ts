import type { SupabaseClient } from '@supabase/supabase-js'

export type UserState = 'unauthenticated' | 'no_onboarding' | 'complete'

// Judgment order: unauthenticated → no_onboarding → complete
// Group membership is no longer required to proceed (A1: group-free model).
export async function getUserState(supabase: SupabaseClient): Promise<UserState> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return 'unauthenticated'

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  if (userError) throw new Error(`getUserState: users query failed: ${userError.message}`)
  if (!userData?.onboarding_completed) return 'no_onboarding'

  return 'complete'
}
