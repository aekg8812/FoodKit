import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import SettingsPasswordForm from './SettingsPasswordForm'

export default async function SettingsPasswordPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // email is needed client-side for re-authentication before password change
  const { data: profile, error } = await supabase
    .from('users')
    .select('email')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('SettingsPasswordPage: failed to load email', {
      message: error.message,
      code: error.code,
    })
    throw new Error('設定情報を読み込めませんでした。')
  }

  return <SettingsPasswordForm userEmail={profile.email} />
}
