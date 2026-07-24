import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RestaurantNewForm from './RestaurantNewForm'

export default async function RestaurantNewPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // TODO: Consider blocking restaurant registration for no_onboarding users to keep
  //   the user journey consistent (complete onboarding before using core features).

  // Fetch the user's first group membership. MVP assumes 1 user = 1 group.
  // If the user belongs to multiple groups, the first result (by DB insertion order) is used.
  const { data: membership, error } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`RestaurantNewPage: failed to fetch group membership: ${error.message}`)
  }

  // No group means the user has not joined any group yet.
  if (!membership) redirect('/groups/join')

  return <RestaurantNewForm groupId={membership.group_id as string} />
}
