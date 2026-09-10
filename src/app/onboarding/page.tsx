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

  // グループ参加済み・診断未完了のユーザーだけ表示する
  if (state !== 'no_onboarding') {
    redirect('/home')
  }

  {/* 再診断対応: このルートは初回診断として表示する */}
  return <OnboardingForm mode="initial" />
}
