import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import RecordSearchClient from './RecordSearchClient'

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
      <div className="mx-auto w-full max-w-md px-5 pt-14">
        <PageHeader title="記録する" />
        <div className="mt-6">
          <RecordSearchClient />
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
