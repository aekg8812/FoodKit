import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { redirect } from 'next/navigation'
import GroupsClient, {
  type GroupRow,
  type MemberRow,
  type MemberProfileRow,
} from './GroupsClient'

export default async function GroupsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [groupsResult, membersResult, memberProfilesResult] = await Promise.all([
    supabase.from('groups').select('id, name, invite_code').order('created_at'),
    supabase
      .from('group_members')
      .select('group_id, user_id, users:user_public_profiles(id, name)'),
    supabase.from('user_public_value_profiles').select('user_id, main_value_type'),
  ])

  if (groupsResult.error) {
    console.error('GroupsPage: failed to load groups', groupsResult.error)
    throw new Error(`GroupsPage: failed to load groups: ${groupsResult.error.message}`)
  }
  if (membersResult.error) {
    console.error('GroupsPage: failed to load members', membersResult.error)
    throw new Error(`GroupsPage: failed to load members: ${membersResult.error.message}`)
  }
  if (memberProfilesResult.error) {
    console.error('GroupsPage: failed to load member profiles', memberProfilesResult.error)
    throw new Error(
      `GroupsPage: failed to load member profiles: ${memberProfilesResult.error.message}`,
    )
  }

  return (
    <GroupsClient
      currentUserId={user.id}
      groups={(groupsResult.data ?? []) as GroupRow[]}
      members={(membersResult.data ?? []) as unknown as MemberRow[]}
      memberProfiles={(memberProfilesResult.data ?? []) as MemberProfileRow[]}
    />
  )
}
