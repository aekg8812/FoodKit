import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import GroupsList, { type GroupListItem } from '@/app/friends/GroupsList'
import FriendsAddMenu from '@/app/friends/FriendsAddMenu'

export default async function GroupsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/groups', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  let groups: GroupListItem[] = []
  let groupsErrorMessage: string | undefined

  const { data, error } = await supabase
    .from('groups')
    .select('id, name')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('GroupsPage: failed to load groups', error)
    groupsErrorMessage = 'グループ一覧を読み込めませんでした。もう一度お試しください。'
  } else {
    groups = (data ?? []) as GroupListItem[]
  }

  return (
    <main className="min-h-screen bg-canvas px-6 pt-6 pb-24">
      <div className="mx-auto w-full max-w-md">
        <PageHeader
          title="グループ"
          action={<FriendsAddMenu activeTab="groups" />}
        />
        <div className="mt-6">
          <GroupsList groups={groups} errorMessage={groupsErrorMessage} />
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
