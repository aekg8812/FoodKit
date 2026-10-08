import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import NotificationsClient from './NotificationsClient'

export default async function NotificationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <Suspense>
          <BackButton fallbackHref="/home" label="" />
        </Suspense>
        <h1 className="text-base font-bold text-ink">通知</h1>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-md px-4">
        <Suspense>
          <NotificationsClient supabaseUrl={supabaseUrl} />
        </Suspense>
      </div>

      <BottomNav />
    </main>
  )
}
