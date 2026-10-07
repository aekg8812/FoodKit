import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import UserSearchClient from './UserSearchClient'

export default async function UserSearchPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // Pre-load viewer's current following list so the client can show state immediately
  const { data: followingData } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', user.id)
    .eq('status', 'accepted')

  const followingIds = (followingData ?? []).map((f) => f.followee_id as string)

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 pb-20">
      <div className="mx-auto max-w-md space-y-4">
        <Suspense>
          <BackButton fallbackHref="/mypage/follows" label="← 戻る" />
        </Suspense>

        <h1 className="text-base font-bold text-ink">ユーザーを探す</h1>

        <UserSearchClient viewerId={user.id} initialFollowingIds={followingIds} />
      </div>

      <BottomNav />
    </main>
  )
}
