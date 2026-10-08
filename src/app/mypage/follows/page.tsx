import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import FollowsClient, { type FollowUserRow } from './FollowsClient'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type ProfileRow = {
  id: string
  username: string
  name: string
  avatar_path: string | null
  updated_at: string | null
}

type FollowEdge = {
  follower_id: string
  followee_id: string
}

export default async function FollowsPage({ searchParams }: PageProps) {
  const raw = await searchParams
  const tabRaw = Array.isArray(raw.tab) ? raw.tab[0] : raw.tab
  const tab = tabRaw === 'followers' ? 'followers' : 'following'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // Query follows edges involving the viewer
  const { data: edgesData, error: edgesError } = await supabase
    .from('follows')
    .select('follower_id, followee_id')
    .or(`follower_id.eq.${user.id},followee_id.eq.${user.id}`)
    .eq('status', 'accepted')

  if (edgesError) throw new Error(`FollowsPage: follows query failed: ${edgesError.message}`)

  const edges = (edgesData ?? []) as FollowEdge[]
  const outgoing = edges.filter((f) => f.follower_id === user.id)
  const incoming = edges.filter((f) => f.followee_id === user.id)
  const outgoingIds = new Set(outgoing.map((f) => f.followee_id))

  // Collect all relevant user IDs (avoid SELECT on users directly)
  const relevantIds = [
    ...new Set([...outgoing.map((f) => f.followee_id), ...incoming.map((f) => f.follower_id)]),
  ]

  // Load profiles from user_public_profiles view
  const profileMap = new Map<string, ProfileRow>()
  if (relevantIds.length > 0) {
    const { data: profilesData, error: profilesError } = await supabase
      .from('user_public_profiles')
      .select('id, username, name, avatar_path, updated_at')
      .in('id', relevantIds)

    if (profilesError)
      throw new Error(`FollowsPage: profiles query failed: ${profilesError.message}`)

    for (const p of (profilesData ?? []) as ProfileRow[]) {
      profileMap.set(p.id, p)
    }
  }

  function buildAvatarUrl(path: string | null, updatedAt: string | null): string | null {
    if (!path) return null
    const pub = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    return updatedAt ? `${pub}?v=${encodeURIComponent(updatedAt)}` : pub
  }

  const followingList: FollowUserRow[] = outgoing
    .map((f) => {
      const p = profileMap.get(f.followee_id)
      if (!p) return null
      return {
        id: p.id,
        username: p.username,
        name: p.name,
        avatar_url: buildAvatarUrl(p.avatar_path, p.updated_at),
        is_following_back: false,
      }
    })
    .filter((x): x is FollowUserRow => x !== null)

  const followersList: FollowUserRow[] = incoming
    .map((f) => {
      const p = profileMap.get(f.follower_id)
      if (!p) return null
      return {
        id: p.id,
        username: p.username,
        name: p.name,
        avatar_url: buildAvatarUrl(p.avatar_path, p.updated_at),
        is_following_back: outgoingIds.has(p.id),
      }
    })
    .filter((x): x is FollowUserRow => x !== null)

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <Suspense>
          <BackButton fallbackHref="/mypage" label="" />
        </Suspense>
        <h1 className="text-base font-bold text-ink">フォロー・フォロワー</h1>
        <div className="w-10" />
      </div>

      {/* User search bar */}
      <div className="px-5 mb-4">
        <Link
          href={`/mypage/follows/search?tab=${tab}`}
          className="flex items-center gap-3 rounded-full border border-edge bg-surface px-4 py-3 shadow-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span className="text-sm text-ink-sub">ユーザーIDで検索</span>
        </Link>
      </div>

      <div className="mx-auto max-w-md px-5">
        <Suspense>
          <FollowsClient
            viewerId={user.id}
            tab={tab}
            followingList={followingList}
            followersList={followersList}
          />
        </Suspense>
      </div>

      <BottomNav />
    </main>
  )
}
