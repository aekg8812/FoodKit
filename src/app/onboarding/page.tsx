import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import OnboardingForm from './OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const state = await getUserState(supabase)

  // グループ参加済み・診断未完了のユーザーだけ表示する
  if (state !== 'no_onboarding') {
    redirect('/home')
  }

  return <OnboardingForm />
}