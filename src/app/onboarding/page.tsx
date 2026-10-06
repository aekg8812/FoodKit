import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import OnboardingForm from './OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const state = await getUserState(supabase, user)

  if (state !== 'no_onboarding') {
    redirect('/home')
  }

  // V2 users are redirected to the preference-cards route instead of V1 diagnosis.
  const { data: userRow } = await supabase
    .from('users')
    .select('onboarding_version')
    .eq('id', user!.id)
    .single()

  if (userRow?.onboarding_version === 2) {
    redirect('/onboarding/preferences')
  }

  return <OnboardingForm mode="initial" />
}
