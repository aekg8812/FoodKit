import type { SupabaseClient } from '@supabase/supabase-js'

export type UserState = 'unauthenticated' | 'no_group' | 'no_onboarding' | 'complete'

// Judgment order: unauthenticated → no_group → no_onboarding → complete
// Group membership is checked before onboarding to ensure users join a group first.
export async function getUserState(supabase: SupabaseClient): Promise<UserState> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return 'unauthenticated'

  const { count, error: groupError } = await supabase
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (groupError) throw new Error(`getUserState: group_members query failed: ${groupError.message}`)
  if (count === null || count === 0) return 'no_group'

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  if (userError) throw new Error(`getUserState: users query failed: ${userError.message}`)
  if (!userData?.onboarding_completed) return 'no_onboarding'

  return 'complete'
}
