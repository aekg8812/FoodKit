'use client'

import { useState, useCallback, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { followUser, unfollowUser } from '@/lib/follows/mutations'
import { createClient } from '@/lib/supabase/client'

type SearchResult = {
  id: string
  username: string
  name: string
}

type Props = {
  viewerId: string
  initialFollowingIds: string[]
  returnTab: 'following' | 'followers'
  initialQuery: string
}

export default function UserSearchClient({
  viewerId,
  initialFollowingIds,
  returnTab,
  initialQuery,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(() => new Set(initialFollowingIds))
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const supabase = createClient()

  // Run initial search if page loaded with ?q=
  useEffect(() => {
    if (initialQuery.trim().length >= 2) {
      startTransition(async () => {
        const { data } = await supabase.rpc('search_users_by_username', {
          p_query: initialQuery.trim(),
        })
        setResults((data ?? []) as SearchResult[])
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateUrl = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value.trim()) {
        params.set('q', value.trim())
      } else {
        params.delete('q')
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value)
      updateUrl(value)
      if (value.trim().length < 2) {
        setResults([])
        return
      }
      startTransition(async () => {
        const { data } = await supabase.rpc('search_users_by_username', { p_query: value.trim() })
        setResults((data ?? []) as SearchResult[])
      })
    },
    [supabase, updateUrl],
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

  const showEmpty = query.trim().length >= 2 && results.length === 0 && !isPending

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-sub" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </span>
        <input
          type="search"
          placeholder="@ユーザーIDで検索"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-full border border-edge bg-surface py-3 pl-10 pr-10 text-sm text-ink placeholder-ink-sub focus:outline-none focus:ring-2 focus:ring-terra"
          autoFocus
        />
        {query.trim().length > 0 && !isPending && (
          <button
            type="button"
            onClick={() => handleSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-ink-sub/20 text-ink-sub"
            aria-label="クリア"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        {isPending && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-sub">
            検索中…
          </span>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <>
          <p className="text-sm font-bold text-ink">
            検索結果 <span className="text-terra">{results.length}件</span>
          </p>
          <ul className="space-y-2">
            {results.map((user) => {
              const isFollowing = followingIds.has(user.id)
              const isLoading = loadingId === user.id
              const displayName = user.name ?? user.username
              const initial = Array.from(displayName.trim())[0] ?? '?'
              return (
                <li
                  key={user.id}
                  className="flex items-center gap-3 rounded-2xl border border-edge bg-surface px-4 py-3"
                >
                  <Link href={`/users/${user.username}`} className="shrink-0">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-edge text-base font-bold text-ink-sub">
                      {initial}
                    </span>
                  </Link>
                  <Link href={`/users/${user.username}`} className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{displayName}</p>
                    <p className="truncate text-xs text-ink-sub">@{user.username}</p>
                  </Link>

                  <button
                    type="button"
                    onClick={() => isFollowing ? handleUnfollow(user.id) : handleFollow(user.id)}
                    disabled={isLoading}
                    className={
                      isFollowing
                        ? 'shrink-0 rounded-full border border-terra bg-surface px-3 py-1.5 text-xs font-semibold text-terra transition-colors hover:bg-terra/5 disabled:opacity-50'
                        : 'shrink-0 rounded-full bg-terra px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-terra-deep disabled:opacity-50'
                    }
                  >
                    {isLoading ? '…' : isFollowing ? 'フォロー中' : 'フォロー'}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* 0件 empty state */}
      {showEmpty && (
        <div className="flex flex-col items-center px-2 pt-4 text-center">
          {/* Illustration */}
          <svg width="120" height="100" viewBox="0 0 120 100" fill="none" aria-hidden="true">
            <circle cx="60" cy="42" r="28" fill="#F3E5D8" />
            <circle cx="40" cy="50" r="16" fill="#E8D5C4" />
            <circle cx="80" cy="50" r="16" fill="#E8D5C4" />
            <circle cx="60" cy="42" r="22" fill="none" stroke="#F97316" strokeWidth="4" strokeLinecap="round" />
            <path d="M76 58 L92 74" stroke="#F97316" strokeWidth="4" strokeLinecap="round" />
            <path d="M40 38 Q40 44 46 44 Q46 44 40 48" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M80 38 Q80 44 74 44 Q74 44 80 48" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" fill="none" />
            <line x1="56" y1="56" x2="64" y2="56" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
          </svg>

          <p className="mt-3 text-lg font-bold text-ink">ユーザーが見つかりませんでした</p>
          <p className="mt-1 text-sm text-ink-sub">
            入力したユーザーIDに一致するユーザーは<br />見つかりませんでした。
          </p>

          {/* Tips card */}
          <div className="mt-4 w-full rounded-2xl bg-[#FFF8F5] px-4 py-4 text-left">
            <div className="mb-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-sm font-bold text-ink">見つからない場合は…</p>
            </div>
            <ol className="space-y-3">
              {[
                { title: 'ユーザーIDが正しいか確認する', sub: '@ から始まるIDを入力してください。' },
                { title: 'スペルを確認する', sub: '英数字・記号の入力ミスがないか確認してください。' },
                { title: '別のIDで検索してみる', sub: 'ニックネームなど、他のIDでも検索してみてください。' },
              ].map((tip, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-terra/20 text-xs font-bold text-terra">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-bold text-ink">{tip.title}</p>
                    <p className="text-xs text-ink-sub">{tip.sub}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* CTAs */}
          <button
            type="button"
            onClick={() => { const el = document.querySelector<HTMLInputElement>('input[type="search"]'); el?.focus() }}
            className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-terra text-sm font-bold text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            検索し直す
          </button>
          <button
            type="button"
            onClick={() => handleSearch('')}
            className="mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-terra text-sm font-bold text-terra"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.36" />
            </svg>
            検索キーワードをクリア
          </button>
        </div>
      )}
    </div>
  )
}
