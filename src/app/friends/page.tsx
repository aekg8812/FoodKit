import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/server'
import FriendsList, { type FriendProfile } from './FriendsList'
import FriendsTabs from './FriendsTabs'
import GroupsList, { type GroupListItem } from './GroupsList'

type FollowRow = {
  follower_id: string
  followee_id: string
}

const LOAD_ERROR_MESSAGE = '友人一覧を読み込めませんでした。もう一度お試しください。'
const GROUPS_LOAD_ERROR_MESSAGE =
  'グループ一覧を読み込めませんでした。もう一度お試しください。'

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const { tab } = await searchParams
  const activeTab = tab === 'groups' ? 'groups' : 'friends'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let groups: GroupListItem[] = []
  let groupsErrorMessage: string | undefined
  let incoming: FriendProfile[] = []
  let mutual: FriendProfile[] = []
  let outgoing: FriendProfile[] = []
  let errorMessage: string | undefined

  if (activeTab === 'groups') {
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('id, name')
      .order('created_at', { ascending: true })

    if (groupError) {
      console.error('FriendsPage: failed to load groups', groupError)
      groupsErrorMessage = GROUPS_LOAD_ERROR_MESSAGE
    } else {
      groups = (groupData ?? []) as GroupListItem[]
    }
  } else {
    const { data: followData, error: followError } = await supabase
      .from('follows')
      .select('follower_id, followee_id, created_at')
      .or(`follower_id.eq.${user.id},followee_id.eq.${user.id}`)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })

    if (followError) {
      console.error('FriendsPage: failed to load follows', followError)
      errorMessage = LOAD_ERROR_MESSAGE
    } else {
      const followRows = (followData ?? []) as FollowRow[]
      const incomingIds = new Set(
        followRows
          .filter((row) => row.followee_id === user.id)
          .map((row) => row.follower_id),
      )
      const outgoingIds = new Set(
        followRows
          .filter((row) => row.follower_id === user.id)
          .map((row) => row.followee_id),
      )
      const relatedIds = [
        ...new Set(
          followRows.map((row) =>
            row.follower_id === user.id ? row.followee_id : row.follower_id,
          ),
        ),
      ]

      if (relatedIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('user_public_profiles')
          .select('id, username, name')
          .in('id', relatedIds)

        if (profileError) {
          console.error('FriendsPage: failed to load public profiles', profileError)
          errorMessage = LOAD_ERROR_MESSAGE
        } else {
          const profileById = new Map(
            ((profileData ?? []) as FriendProfile[]).map((profile) => [profile.id, profile]),
          )
          const profilesFor = (ids: string[]) =>
            ids.flatMap((id) => {
              const profile = profileById.get(id)
              return profile ? [profile] : []
            })

          incoming = profilesFor(
            relatedIds.filter((id) => incomingIds.has(id) && !outgoingIds.has(id)),
          )
          mutual = profilesFor(
            relatedIds.filter((id) => incomingIds.has(id) && outgoingIds.has(id)),
          )
          outgoing = profilesFor(
            relatedIds.filter((id) => outgoingIds.has(id) && !incomingIds.has(id)),
          )
        }
      }
    }
  }

  const friendsPanel = (
    <FriendsList
      viewerId={user.id}
      incoming={incoming}
      mutual={mutual}
      outgoing={outgoing}
      errorMessage={errorMessage}
    />
  )
  const groupsPanel = <GroupsList groups={groups} errorMessage={groupsErrorMessage} />

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <div className="mx-auto w-full max-w-md">
        <h1 className="mb-6 text-2xl font-bold text-ink">友人・グループ</h1>
        <Suspense fallback={null}>
          <FriendsTabs friendsPanel={friendsPanel} groupsPanel={groupsPanel} />
        </Suspense>
      </div>
      <BottomNav />
    </main>
  )
}
