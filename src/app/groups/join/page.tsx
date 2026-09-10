import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { redirect } from 'next/navigation'
import GroupsJoinForm from './GroupsJoinForm'

export default async function GroupsJoinPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const state = await getUserState(supabase, user)

  // グループ参加は任意。未認証は proxy.ts が弾く。
  // no_onboarding ユーザーは診断を先に完了させる。
  if (state === 'no_onboarding') redirect('/onboarding')

  return <GroupsJoinForm />
}
