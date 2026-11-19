import Link from 'next/link'
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
    <main className="min-h-screen bg-canvas">
      {/* Onboarding nav header */}
      <div className="sticky top-0 z-10 bg-canvas">
        <div className="flex items-center justify-between px-4 pt-14 pb-2">
          <Link
            href="/onboarding"
            className="inline-flex h-10 w-10 items-center justify-center text-ink"
            aria-label="戻る"
          >
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
              <path d="M9 1 L1 9 L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <span className="text-sm font-medium text-ink">プロフィール設定　2 / 2</span>
          <div className="w-10" />
        </div>
        {/* Orange progress bar (100% = step 2/2) */}
        <div className="h-[3px] w-full bg-terra" />
      </div>

      <PreferenceCardsForm cards={cards} initialKeys={[]} mode="initial" />
    </main>
  )
}
