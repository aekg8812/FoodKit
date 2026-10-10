import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import UserSearchClient from './UserSearchClient'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function UserSearchPage({ searchParams }: PageProps) {
  const raw = await searchParams
  const tabRaw = Array.isArray(raw.tab) ? raw.tab[0] : raw.tab
  const returnTab = tabRaw === 'followers' ? 'followers' : 'following'
  const queryRaw = Array.isArray(raw.q) ? raw.q[0] : raw.q
  const initialQuery = queryRaw?.trim() ?? ''

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data: followingData } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', user.id)
    .eq('status', 'accepted')

  const followingIds = (followingData ?? []).map((f) => f.followee_id as string)

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref={`/mypage/follows?tab=${returnTab}`} label="" />
        </Suspense>
        <div className="flex-1 text-center">
          <h1 className="text-base font-bold text-ink">ユーザーを検索</h1>
          <p className="text-xs text-ink-sub">ユーザーIDからユーザーを探すことができます</p>
        </div>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-md px-4 pt-4">
        <Suspense>
          <UserSearchClient
            viewerId={user.id}
            initialFollowingIds={followingIds}
            returnTab={returnTab}
            initialQuery={initialQuery}
          />
        </Suspense>
      </div>

      <BottomNav />
    </main>
  )
}
