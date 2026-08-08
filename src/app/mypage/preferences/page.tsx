import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import OnboardingForm from '@/app/onboarding/OnboardingForm'

// 再診断対応: 初回診断が完了したユーザーだけ再診断を許可する
export default async function PreferencesPage() {
  const supabase = await createClient()
  const state = await getUserState(supabase)

  if (state === 'unauthenticated') redirect('/login')
  if (state === 'no_group') redirect('/groups/join')
  if (state === 'no_onboarding') redirect('/onboarding')

  return <OnboardingForm mode="retake" />
}
