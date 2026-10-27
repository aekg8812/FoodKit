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
      </div>

      <BottomNav />
    </main>
  )
}
