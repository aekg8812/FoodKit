import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'

export default async function FoodPreferencesSummaryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const selectionResult = await supabase
    .from('user_preference_cards')
    .select('preference_card_id, preference_cards(key, label, sort_order)')
    .eq('user_id', user.id)

  type CardJoin = { key: string; label: string; sort_order: number }

  const selectedCards: CardJoin[] = (selectionResult.data ?? [])
    .map((row) => {
      const pc = row.preference_cards
      if (!pc) return null
      return Array.isArray(pc) ? (pc[0] as CardJoin) : (pc as CardJoin)
    })
    .filter((c): c is CardJoin => c !== null)
    .sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="min-h-screen bg-canvas pb-24">
      <div className="px-6 pt-6">
        <div className="mx-auto w-full max-w-md">
          <PageHeader title="自分の食の価値観" back={{ href: '/mypage' }} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-md px-6 pt-6">
        {selectedCards.length === 0 ? (
          <p className="text-sm text-ink-sub">まだ好みカードが選択されていません。</p>
        ) : (
          <ul className="space-y-2">
            {selectedCards.map((card) => (
              <li
                key={card.key}
                className="rounded-xl border border-edge bg-surface px-4 py-3 text-sm font-medium text-ink"
              >
                {card.label}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8">
          <Link
            href="/mypage/food-preferences/edit"
            className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-terra px-6 text-sm font-semibold text-white transition-colors hover:bg-terra-deep"
          >
            好みを編集する
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
