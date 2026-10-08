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

  type CardJoin = { key: string; label: string; description: string | null; image_path: string | null; sort_order: number }

  const selectionResult = await supabase
    .from('user_preference_cards')
    .select('preference_card_id, preference_cards(key, label, description, image_path, sort_order)')
    .eq('user_id', user.id)

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
      <div className="px-5 pt-14 pb-2">
        <div className="mx-auto w-full max-w-md">
          <PageHeader title="食の価値観" back={{ href: '/mypage' }} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-md px-5 pt-4">
        {selectedCards.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-ink-sub">まだ好みカードが選択されていません。</p>
            <Link
              href="/mypage/food-preferences/edit"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-terra px-6 text-sm font-semibold text-white transition-colors hover:bg-terra-deep"
            >
              好みを設定する
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-sub">あなたがお店選びで大切にしていること</p>

            {/* 2-column card grid with images */}
            <div className="grid grid-cols-2 gap-3">
              {selectedCards.map((card) => (
                <div
                  key={card.key}
                  className="relative overflow-hidden rounded-2xl ring-1 ring-edge"
                  style={{ aspectRatio: '1 / 1' }}
                >
                  {card.image_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.image_path}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{ background: 'linear-gradient(135deg, #FFF3E6 0%, #FFE4CC 100%)' }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-sm font-bold leading-snug text-white drop-shadow-sm">{card.label}</p>
                    {card.description && (
                      <p className="mt-0.5 text-[11px] leading-snug text-white/80 line-clamp-2">{card.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Link
                href="/mypage/food-preferences/edit"
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-terra text-sm font-semibold text-white transition-colors hover:bg-terra-deep"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                好みを編集する
              </Link>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
