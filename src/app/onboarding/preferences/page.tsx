import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import PreferenceCardsForm from '@/components/PreferenceCardsForm'

export default async function OnboardingPreferencesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'complete') redirect('/home')

  const { data: cards, error: cardsError } = await supabase
    .from('preference_cards')
    .select('id, key, label, description, image_path, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  if (cardsError || !cards) redirect('/home')

  return (
    <PreferenceCardsForm
      cards={cards}
      initialKeys={[]}
      mode="initial"
    />
  )
}
