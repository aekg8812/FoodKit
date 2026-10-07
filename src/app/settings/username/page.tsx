import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import SettingsUsernameForm from './SettingsUsernameForm'

export default async function SettingsUsernamePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data: profile, error } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('SettingsUsernamePage: failed to load username', error)
    throw new Error('ユーザーID情報を読み込めませんでした。')
  }

  return <SettingsUsernameForm userId={user.id} currentUsername={profile.username} />
}
