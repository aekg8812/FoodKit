'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { followUser, unfollowUser } from '@/lib/follows/mutations'
import { createClient } from '@/lib/supabase/client'

export type FollowUserRow = {
  id: string
  username: string
  name: string
  avatar_url: string | null
  is_following_back: boolean
}

type Props = {
  viewerId: string
  tab: 'following' | 'followers'
  followingList: FollowUserRow[]
  followersList: FollowUserRow[]
}

function UserItem({
  user,
  viewerId,
  mode,
  onMutate,
}: {
  user: FollowUserRow
  viewerId: string
  mode: 'following' | 'follower'
  onMutate: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [removed, setRemoved] = useState(false)
  const supabase = createClient()

  const initial = Array.from((user.name ?? user.username ?? '?').trim())[0] ?? '?'

  async function handleUnfollow() {
    setLoading(true)
    const result = await unfollowUser(supabase, viewerId, user.id)
    setLoading(false)
    if (result.ok) onMutate()
  }

  async function handleFollow() {
    setLoading(true)
    const result = await followUser(supabase, viewerId, user.id)
    setLoading(false)
    if (result.ok) onMutate()
  }

  async function handleRemoveFollower() {
    setLoading(true)
    const { error } = await supabase.rpc('remove_follower', { p_follower_id: user.id })
    setLoading(false)
    if (!error) {
      setRemoved(true)
      onMutate()
    }
  }

  if (removed) return null

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-edge bg-surface px-4 py-3 shadow-sm">
      <Link href={`/users/${user.username}`} className="shrink-0">
        {user.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={user.name ?? user.username}
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-base font-semibold text-amber-800">
            {initial}
          </span>
        )}
      </Link>

      <Link href={`/users/${user.username}`} className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{user.name ?? user.username}</p>
        <p className="truncate text-xs text-ink-sub">@{user.username}</p>
      </Link>

      <div className="shrink-0">
        {mode === 'following' ? (
          <button
            type="button"
            onClick={handleUnfollow}
            disabled={loading}
            className="rounded-full border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '…' : 'フォロー解除'}
          </button>
        ) : user.is_following_back ? (
          <button
            type="button"
            onClick={handleUnfollow}
            disabled={loading}
            className="rounded-full border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-ink-sub transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '…' : 'フォロー中'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFollow}
            disabled={loading}
            className="rounded-full bg-terra px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-terra-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '…' : 'フォローバック'}
          </button>
        )}
      </div>

      {mode === 'follower' && (
        <button
          type="button"
          onClick={handleRemoveFollower}
          disabled={loading}
          className="shrink-0 text-xs text-ink-sub hover:text-red-600 disabled:opacity-50"
          aria-label="フォロワーから削除"
        >
          削除
        </button>
      )}
    </li>
  )
}

export default function FollowsClient({ viewerId, tab, followingList, followersList }: Props) {
  const router = useRouter()
  const refresh = useCallback(() => router.refresh(), [router])

  const list = tab === 'following' ? followingList : followersList
  const mode = tab === 'following' ? 'following' : 'follower'

  return (
    <div className="space-y-2">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl bg-canvas p-1">
        <Link
          href="?tab=following"
          className={`flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors ${
            tab === 'following'
              ? 'bg-surface text-ink shadow-sm'
              : 'text-ink-sub hover:text-ink'
          }`}
        >
          フォロー中
        </Link>
        <Link
          href="?tab=followers"
          className={`flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors ${
            tab === 'followers'
              ? 'bg-surface text-ink shadow-sm'
              : 'text-ink-sub hover:text-ink'
          }`}
        >
          フォロワー
        </Link>
      </div>

      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-sub">
          {tab === 'following' ? 'まだフォローしている人はいません' : 'まだフォロワーはいません'}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((user) => (
            <UserItem
              key={user.id}
              user={user}
              viewerId={viewerId}
              mode={mode}
              onMutate={refresh}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
