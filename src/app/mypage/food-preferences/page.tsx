import { redirect } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import PreferenceCardsForm from '@/components/PreferenceCardsForm'

export default async function FoodPreferencesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [cardsResult, selectionResult] = await Promise.all([
    supabase
      .from('preference_cards')
      .select('id, key, label, description, image_path, sort_order')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('user_preference_cards')
      .select('preference_card_id, preference_cards(key)')
      .eq('user_id', user.id),
  ])

  if (cardsResult.error || !cardsResult.data) redirect('/mypage')

  const initialKeys = (selectionResult.data ?? [])
    .map((row) => {
      const pc = row.preference_cards
      if (!pc) return null
      return Array.isArray(pc) ? (pc[0] as { key: string })?.key : (pc as { key: string }).key
    })
    .filter((k): k is string => k !== null)

  return (
    <div className="min-h-screen bg-canvas">
      <div className="px-6 pt-6">
        <div className="mx-auto w-full max-w-md">
          <PageHeader title="食の好みを編集" back={{ href: '/mypage' }} />
        </div>
      </div>
      <PreferenceCardsForm
        cards={cardsResult.data}
        initialKeys={initialKeys}
        mode="edit"
      />
      <BottomNav />
    </div>
  )
}
