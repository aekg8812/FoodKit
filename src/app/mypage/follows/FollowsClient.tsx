'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { followUser, unfollowUser } from '@/lib/follows/mutations'
import { createClient } from '@/lib/supabase/client'
import BottomSheet from '@/components/ui/BottomSheet'

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

// ────────────────────────────────────────────────────────────────────
// Follower row — uses BottomSheet for management actions
// ────────────────────────────────────────────────────────────────────
function FollowerItem({
  user,
  viewerId,
  onMutate,
}: {
  user: FollowUserRow
  viewerId: string
  onMutate: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const supabase = createClient()

  const initial = Array.from((user.name ?? user.username ?? '?').trim())[0] ?? '?'
  const displayName = user.name ?? user.username

  async function handleFollow() {
    setLoading(true)
    const result = await followUser(supabase, viewerId, user.id)
    setLoading(false)
    if (result.ok) onMutate()
  }

  async function handleUnfollow() {
    setLoading(true)
    const result = await unfollowUser(supabase, viewerId, user.id)
    setLoading(false)
    if (result.ok) onMutate()
  }

  async function handleRemoveConfirmed() {
    setLoading(true)
    setErrorMessage(null)
    const { error } = await supabase.rpc('remove_follower', { p_follower_id: user.id })
    setLoading(false)
    if (error) {
      setErrorMessage('削除に失敗しました。もう一度お試しください。')
      return
    }
    setConfirmOpen(false)
    setRemoved(true)
    onMutate()
  }

  if (removed) return null

  return (
    <li className="flex items-center gap-3 bg-surface px-4 py-3">
      <Link href={`/users/${user.username}`} className="shrink-0">
        {user.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={displayName}
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
        <p className="truncate font-medium text-ink">{displayName}</p>
        <p className="truncate text-xs text-ink-sub">@{user.username}</p>
      </Link>

      {/* フォローバック / フォロー中 */}
      <div className="shrink-0">
        {user.is_following_back ? (
          <button
            type="button"
            onClick={handleUnfollow}
            disabled={loading}
            className="rounded-full border border-terra bg-surface px-3 py-1.5 text-xs font-semibold text-terra transition-colors hover:bg-terra/5 disabled:opacity-50"
          >
            {loading ? '…' : 'フォロー中'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFollow}
            disabled={loading}
            className="rounded-full bg-terra px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-terra-deep disabled:opacity-50"
          >
            {loading ? '…' : 'フォローバック'}
          </button>
        )}
      </div>

      {/* … menu button */}
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-ink-sub transition-colors hover:bg-canvas hover:text-ink"
        aria-label="メニューを開く"
      >
        …
      </button>

      {/* Follower management menu */}
      <BottomSheet
        id={`follower-menu-${user.id}`}
        open={menuOpen}
        title={displayName}
        onClose={() => setMenuOpen(false)}
      >
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              setConfirmOpen(true)
            }}
            className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            フォロワーから削除
          </button>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-edge bg-canvas px-4 py-3 text-left text-sm font-medium text-ink-sub opacity-50"
          >
            ミュート（この機能は今後対応予定です）
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="w-full rounded-xl border border-edge bg-surface px-4 py-3 text-left text-sm font-medium text-ink transition-colors hover:bg-canvas"
          >
            キャンセル
          </button>
        </div>
      </BottomSheet>

      {/* Remove confirmation */}
      <BottomSheet
        id={`follower-confirm-${user.id}`}
        open={confirmOpen}
        title="フォロワーから削除"
        onClose={() => {
          setConfirmOpen(false)
          setErrorMessage(null)
        }}
      >
        <p className="text-sm leading-6 text-ink-sub">
          {displayName}さんをフォロワーから削除しますか？
        </p>
        {errorMessage && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {errorMessage}
          </p>
        )}
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={handleRemoveConfirmed}
            disabled={loading}
            className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '処理中…' : '削除する'}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmOpen(false)
              setErrorMessage(null)
            }}
            disabled={loading}
            className="w-full rounded-xl border border-edge bg-surface px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
          >
            キャンセル
          </button>
        </div>
      </BottomSheet>
    </li>
  )
}

// ────────────────────────────────────────────────────────────────────
// Following row — simple unfollow button
// ────────────────────────────────────────────────────────────────────
function FollowingItem({
  user,
  viewerId,
  onMutate,
}: {
  user: FollowUserRow
  viewerId: string
  onMutate: () => void
}) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const initial = Array.from((user.name ?? user.username ?? '?').trim())[0] ?? '?'
  const displayName = user.name ?? user.username

  async function handleUnfollow() {
    setLoading(true)
    const result = await unfollowUser(supabase, viewerId, user.id)
    setLoading(false)
    if (result.ok) onMutate()
  }

  return (
    <li className="flex items-center gap-3 bg-surface px-4 py-3">
      <Link href={`/users/${user.username}`} className="shrink-0">
        {user.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={displayName}
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
        <p className="truncate font-medium text-ink">{displayName}</p>
        <p className="truncate text-xs text-ink-sub">@{user.username}</p>
      </Link>

      <button
        type="button"
        onClick={handleUnfollow}
        disabled={loading}
        className="shrink-0 rounded-full border border-terra bg-surface px-3 py-1.5 text-xs font-semibold text-terra transition-colors hover:bg-terra/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? '…' : 'フォロー中'}
      </button>
    </li>
  )
}

// ────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────
export default function FollowsClient({ viewerId, tab, followingList, followersList }: Props) {
  const router = useRouter()
  const refresh = useCallback(() => router.refresh(), [router])

  const list = tab === 'following' ? followingList : followersList

  return (
    <div>
      {/* Tab switcher — underline style */}
      <div className="flex border-b border-edge">
        <Link
          href="?tab=following"
          className={`flex flex-1 items-center justify-center py-3 text-sm font-semibold transition-colors ${
            tab === 'following'
              ? 'border-b-2 border-terra text-terra'
              : 'text-ink-sub hover:text-ink'
          }`}
        >
          フォロー {followingList.length}
        </Link>
        <Link
          href="?tab=followers"
          className={`flex flex-1 items-center justify-center py-3 text-sm font-semibold transition-colors ${
            tab === 'followers'
              ? 'border-b-2 border-terra text-terra'
              : 'text-ink-sub hover:text-ink'
          }`}
        >
          フォロワー {followersList.length}
        </Link>
      </div>

      {list.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-sub">
          {tab === 'following' ? 'まだフォローしている人はいません' : 'まだフォロワーはいません'}
        </p>
      ) : (
        <ul className="divide-y divide-edge">
          {tab === 'followers'
            ? followersList.map((user) => (
                <FollowerItem key={user.id} user={user} viewerId={viewerId} onMutate={refresh} />
              ))
            : followingList.map((user) => (
                <FollowingItem key={user.id} user={user} viewerId={viewerId} onMutate={refresh} />
              ))}
        </ul>
      )}
    </div>
  )
}
