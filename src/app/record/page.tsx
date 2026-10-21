import Link from 'next/link'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import RecordSearchClient from './RecordSearchClient'
import NearbyRestaurantsSection from './NearbyRestaurantsSection'

export default async function RecordPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/record', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  return (
    <main className="min-h-screen bg-canvas pb-24">
      <div className="border-b border-edge bg-canvas px-4 pt-14 pb-3 text-center">
        <h1 className="text-xl font-black text-ink">記録する</h1>
      </div>

      <div className="px-4 pt-4 space-y-5">
        <p className="text-sm text-ink-sub">記録するお店を選んでください</p>

        <RecordSearchClient />

        <NearbyRestaurantsSection />

        {/* Manual registration CTA */}
        <div className="overflow-hidden rounded-2xl bg-[#FFF3EC] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terra/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-ink">お店が見つかりませんか？</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-sub">
                FoodKitにまだ登録されていないお店は新しく追加できます
              </p>
            </div>
          </div>
          <Link
            href="/restaurants/new?from=record"
            className="mt-3 flex h-[48px] items-center justify-center gap-1.5 rounded-full border-2 border-terra text-base font-bold text-terra"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新しい飲食店を登録
          </Link>
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
