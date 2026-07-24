import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { redirect } from 'next/navigation'
import GroupsJoinForm from './GroupsJoinForm'

export default async function GroupsJoinPage() {
  const supabase = await createClient()
  const state = await getUserState(supabase)

  // Allow only users who have no group yet.
  // proxy.ts blocks unauthenticated users before they reach here.
  if (state !== 'no_group') redirect('/home')

  return <GroupsJoinForm />
}
