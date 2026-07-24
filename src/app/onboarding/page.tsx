import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { redirect } from 'next/navigation'
import OnboardingForm, { type OnboardingQuestion } from './OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const state = await getUserState(supabase)

  // Allow only users who have joined a group but not yet completed onboarding.
  // proxy.ts blocks unauthenticated users before they reach here.
  if (state !== 'no_onboarding') redirect('/home')

  const { data: rows, error } = await supabase
    .from('value_questions')
    .select('id, question_text, sort_order, value_options(id, option_text)')
    .eq('is_initial', true)
    .order('sort_order')

  if (error) {
    throw new Error(`OnboardingPage: failed to load questions: ${error.message}`)
  }

  type QuestionRow = OnboardingQuestion & { sort_order: number }
  const questions = (rows ?? []) as QuestionRow[]

  const q1 = questions.find((q) => q.sort_order === 1)
  const q2a = questions.find((q) => q.sort_order === 2)
  const q2b = questions.find((q) => q.sort_order === 3)

  if (!q1 || !q2a || !q2b) {
    throw new Error('OnboardingPage: missing expected questions (sort_order 1/2/3) in seed data')
  }

  return <OnboardingForm q1={q1} q2a={q2a} q2b={q2b} />
}
