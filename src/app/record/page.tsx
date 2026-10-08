import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import RecordSearchClient from './RecordSearchClient'

type RecentRestaurant = {
  id: string
  name: string
  genre: string | null
  area: string | null
  address: string | null
}

export default async function RecordPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/record', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // Fetch user's recently reviewed restaurants (dedup by restaurant_id)
  const { data: reviewRows } = await supabase
    .from('reviews')
    .select('restaurant_id, restaurants(id, name, genre, area, address), created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(60)

  const seen = new Set<string>()
  const recentRestaurants: RecentRestaurant[] = []
  for (const row of reviewRows ?? []) {
    const rest = row.restaurants as unknown as RecentRestaurant | null
    if (!rest || seen.has(rest.id)) continue
    seen.add(rest.id)
    recentRestaurants.push(rest)
    if (recentRestaurants.length >= 10) break
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      <div className="border-b border-edge bg-canvas px-4 pt-14 pb-3 text-center">
        <h1 className="text-xl font-black text-ink">記録する</h1>
      </div>

      <div className="px-4 pt-4">
        <RecordSearchClient recentRestaurants={recentRestaurants} />
      </div>

      <BottomNav />
    </main>
  )
}
