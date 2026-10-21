import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import GroupsJoinForm from './GroupsJoinForm'

export default async function GroupsJoinPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const state = await getUserState(supabase, user)

  // no_onboarding ユーザーは診断を先に完了させる。
  if (state === 'no_onboarding') redirect('/onboarding')

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <div className="flex items-center">
          <Link
            href="/groups"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-sub hover:bg-edge"
            aria-label="戻る"
          >
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
              <path d="M9 1L1 9l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="flex-1 text-center text-base font-bold text-ink">グループを追加</h1>
          <div className="w-10" />
        </div>
        <p className="mt-1 text-center text-xs text-ink-sub">友達と一緒にお店を探すグループを追加できます</p>
      </div>

      <Suspense>
        <GroupsJoinForm />
      </Suspense>

      <BottomNav />
    </main>
  )
}
