'use client'

import { useState, useCallback, useTransition } from 'react'
import Link from 'next/link'
import { followUser, unfollowUser } from '@/lib/follows/mutations'
import { createClient } from '@/lib/supabase/client'

type SearchResult = {
  id: string
  username: string
  name: string
  main_value_type: string | null
}

type Props = {
  viewerId: string
  initialFollowingIds: string[]
}

export default function UserSearchClient({ viewerId, initialFollowingIds }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(() => new Set(initialFollowingIds))
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const supabase = createClient()

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value)
      if (value.trim().length < 2) {
        setResults([])
        return
      }
      startTransition(async () => {
        const { data } = await supabase.rpc('search_users_by_username', { p_query: value.trim() })
        setResults((data ?? []) as SearchResult[])
      })
    },
    [supabase],
  )

  async function handleFollow(targetId: string) {
    setLoadingId(targetId)
    const result = await followUser(supabase, viewerId, targetId)
    if (result.ok) setFollowingIds((prev) => new Set([...prev, targetId]))
    setLoadingId(null)
  }

  async function handleUnfollow(targetId: string) {
    setLoadingId(targetId)
    const result = await unfollowUser(supabase, viewerId, targetId)
    if (result.ok) {
      setFollowingIds((prev) => {
        const next = new Set(prev)
        next.delete(targetId)
        return next
      })
    }
    setLoadingId(null)
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="search"
          placeholder="ユーザー名を検索（2文字以上）"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-xl border border-edge bg-surface px-4 py-3 text-sm text-ink placeholder-ink-sub focus:outline-none focus:ring-2 focus:ring-terra"
        />
        {isPending && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-sub">
            検索中…
          </span>
        )}
      </div>

      {query.trim().length >= 2 && results.length === 0 && !isPending && (
        <p className="py-4 text-center text-sm text-ink-sub">ユーザーが見つかりませんでした</p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((user) => {
            const isFollowing = followingIds.has(user.id)
            const isLoading = loadingId === user.id
            return (
              <li
                key={user.id}
                className="flex items-center gap-3 rounded-2xl border border-edge bg-surface px-4 py-3 shadow-sm"
              >
                <Link href={`/users/${user.username}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{user.name ?? user.username}</p>
                  <p className="truncate text-xs text-ink-sub">@{user.username}</p>
                </Link>

                <button
                  type="button"
                  onClick={() => isFollowing ? handleUnfollow(user.id) : handleFollow(user.id)}
                  disabled={isLoading}
                  className={
                    isFollowing
                      ? 'shrink-0 rounded-full border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-ink-sub transition-colors hover:bg-canvas disabled:opacity-50'
                      : 'shrink-0 rounded-full bg-terra px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-terra-deep disabled:opacity-50'
                  }
                >
                  {isLoading ? '…' : isFollowing ? 'フォロー中' : 'フォロー'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
