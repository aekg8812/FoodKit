'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import ValueTypeBadge from '@/components/ValueTypeBadge'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import ErrorMessage from '@/components/ui/ErrorMessage'
import InputField from '@/components/ui/InputField'
import { followUser, unfollowUser } from '@/lib/follows/mutations'
import { createClient } from '@/lib/supabase/client'

const SEARCH_DELAY_MS = 400

type SearchResult = {
  id: string
  username: string
  name: string
  main_value_type: string | null
}

type FollowRelationship = 'mutual' | 'outgoing' | 'incoming' | 'none'

type SearchResultWithRelationship = SearchResult & {
  relationship: FollowRelationship
}

type FollowRow = {
  follower_id: string
  followee_id: string
}

type SearchState = {
  query: string
  results: SearchResultWithRelationship[] | null
  error: string | null
}

const RELATIONSHIP_LABEL: Record<FollowRelationship, string> = {
  mutual: '友人 ✓',
  outgoing: 'フォロー中',
  incoming: 'フォローバック',
  none: 'フォロー',
}

const NEXT_RELATIONSHIP: Record<FollowRelationship, FollowRelationship> = {
  mutual: 'incoming',
  outgoing: 'none',
  incoming: 'mutual',
  none: 'outgoing',
}

const UNEXPECTED_ERROR_MESSAGE = 'フォロー操作に失敗しました。もう一度お試しください。'

function logSupabaseError(
  context: string,
  error: { message?: string; code?: string; details?: string; hint?: string },
) {
  console.error(context, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  })
}

export default function FriendsSearchPage() {
  const supabase = useMemo(() => createClient(), [])
  const searchSeq = useRef(0)
  const [query, setQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [searchState, setSearchState] = useState<SearchState | null>(null)
  const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(() => new Set())
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [confirmTarget, setConfirmTarget] = useState<SearchResultWithRelationship | null>(null)
  const inFlightUserIdsRef = useRef(new Set<string>())

  const currentSearch = searchState?.query === query ? searchState : null
  const loading = hasSearched && authError === null && currentSearch === null

  useEffect(() => {
    let active = true

    async function loadViewer() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (!active) return
      if (error || !user) {
        if (error) logSupabaseError('FriendsSearchPage: failed to get user', error)
        setAuthError('ログイン情報を確認できませんでした。もう一度お試しください。')
        return
      }

      setViewerId(user.id)
    }

    void loadViewer()

    return () => {
      active = false
    }
  }, [supabase])

  useEffect(() => {
    if (!hasSearched || !viewerId) return

    const seq = ++searchSeq.current
    const timer = setTimeout(async () => {
      const { data, error: searchError } = await supabase.rpc('search_users_by_username', {
        p_query: query,
      })

      if (seq !== searchSeq.current) return
      if (searchError) {
        logSupabaseError('FriendsSearchPage: search_users_by_username failed', searchError)
        setSearchState({
          query,
          results: null,
          error: '検索に失敗しました。時間をおいてもう一度お試しください。',
        })
        return
      }

      const { data: followsData, error: followsError } = await supabase
        .from('follows')
        .select('follower_id, followee_id')
        .or(`follower_id.eq.${viewerId},followee_id.eq.${viewerId}`)

      if (seq !== searchSeq.current) return
      if (followsError) {
        logSupabaseError('FriendsSearchPage: failed to load follow relationships', followsError)
        setSearchState({
          query,
          results: null,
          error: 'フォロー状態を確認できませんでした。もう一度お試しください。',
        })
        return
      }

      const following = new Set<string>()
      const followers = new Set<string>()

      for (const follow of (followsData ?? []) as FollowRow[]) {
        if (follow.follower_id === viewerId) following.add(follow.followee_id)
        if (follow.followee_id === viewerId) followers.add(follow.follower_id)
      }

      const results = ((data ?? []) as SearchResult[]).map((result) => {
        const isFollowing = following.has(result.id)
        const isFollower = followers.has(result.id)
        let relationship: FollowRelationship = 'none'

        if (isFollowing && isFollower) relationship = 'mutual'
        else if (isFollowing) relationship = 'outgoing'
        else if (isFollower) relationship = 'incoming'

        return { ...result, relationship }
      })

      setSearchState({ query, results, error: null })
    }, SEARCH_DELAY_MS)

    return () => clearTimeout(timer)
  }, [hasSearched, query, supabase, viewerId])

  async function executeRelationshipMutation(target: SearchResultWithRelationship) {
    if (!viewerId || inFlightUserIdsRef.current.has(target.id)) return

    inFlightUserIdsRef.current.add(target.id)
    setPendingUserIds((current) => new Set(current).add(target.id))
    setRowErrors((current) => {
      const next = { ...current }
      delete next[target.id]
      return next
    })

    try {
      const mutationResult =
        target.relationship === 'none' || target.relationship === 'incoming'
          ? await followUser(supabase, viewerId, target.id)
          : await unfollowUser(supabase, viewerId, target.id)

      if (!mutationResult.ok) {
        setRowErrors((current) => ({
          ...current,
          [target.id]: mutationResult.message,
        }))
        return
      }

      setSearchState((current) => {
        if (!current?.results) return current

        return {
          ...current,
          results: current.results.map((result) =>
            result.id === target.id
              ? { ...result, relationship: NEXT_RELATIONSHIP[target.relationship] }
              : result,
          ),
        }
      })

      if (target.relationship === 'mutual') setConfirmTarget(null)
    } catch (error) {
      console.error('FriendsSearchPage: unexpected follow mutation error', error)
      setRowErrors((current) => ({
        ...current,
        [target.id]: UNEXPECTED_ERROR_MESSAGE,
      }))
    } finally {
      inFlightUserIdsRef.current.delete(target.id)
      setPendingUserIds((current) => {
        const next = new Set(current)
        next.delete(target.id)
        return next
      })
    }
  }

  function handleRelationshipAction(target: SearchResultWithRelationship) {
    if (target.relationship === 'mutual') {
      setRowErrors((current) => {
        const next = { ...current }
        delete next[target.id]
        return next
      })
      setConfirmTarget(target)
      return
    }

    void executeRelationshipMutation(target)
  }

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/friends?tab=friends"
          className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-ink-sub transition-colors hover:text-ink"
        >
          ← 友人一覧に戻る
        </Link>

        <h1 className="mb-1 text-2xl font-bold text-ink">ユーザー検索</h1>
        <p className="mb-6 text-sm text-ink-sub">ユーザーIDから友人を探せます。</p>

        <Card as="section" className="mb-4 p-6">
          <InputField
            id="friends-search-query"
            label="ユーザーID"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setHasSearched(true)
            }}
            placeholder="aya"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Card>

        {authError ? (
          <ErrorMessage message={authError} />
        ) : !hasSearched ? (
          <Card as="section" className="p-6 text-center">
            <p className="text-sm text-ink-sub">ユーザーIDで検索してください</p>
          </Card>
        ) : loading ? (
          <Card as="section" className="p-6 text-center" aria-live="polite">
            <p className="text-sm text-ink-sub">検索中...</p>
          </Card>
        ) : currentSearch?.error ? (
          <ErrorMessage message={currentSearch.error} />
        ) : currentSearch?.results?.length === 0 ? (
          <Card as="section" className="p-6 text-center">
            <p className="text-sm text-ink-sub">見つかりませんでした</p>
          </Card>
        ) : currentSearch?.results ? (
          <Card as="section" className="p-4">
            <p className="mb-3 px-2 text-xs text-ink-sub">{currentSearch.results.length}件</p>
            <ul className="divide-y divide-edge">
              {currentSearch.results.map((result) => (
                <li key={result.id} className="flex items-center gap-2 py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/users/${result.username}`}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-canvas"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream text-base font-bold text-terra"
                    >
                      {result.name.charAt(0) || '?'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {result.name}
                      </span>
                      <span className="block truncate text-xs text-ink-sub">@{result.username}</span>
                      <span className="mt-1 block">
                        <ValueTypeBadge type={result.main_value_type} />
                      </span>
                    </span>
                  </Link>
                  <div className="w-24 shrink-0 text-right">
                    <Button
                      type="button"
                      loading={pendingUserIds.has(result.id)}
                      disabled={!viewerId || pendingUserIds.has(result.id)}
                      onClick={() => handleRelationshipAction(result)}
                      className="w-full px-2"
                      aria-label={`${result.name}: ${RELATIONSHIP_LABEL[result.relationship]}`}
                    >
                      {pendingUserIds.has(result.id)
                        ? '処理中…'
                        : RELATIONSHIP_LABEL[result.relationship]}
                    </Button>
                    {rowErrors[result.id] ? (
                      <p role="alert" className="mt-1 text-left text-xs text-red-600">
                        {rowErrors[result.id]}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <BottomSheet
        id="friends-search-remove-friend"
        open={confirmTarget !== null}
        title="友人関係を解除"
        onClose={() => setConfirmTarget(null)}
      >
        {confirmTarget ? (
          <>
            <p className="text-sm leading-6 text-ink-sub">
              {confirmTarget.name}
              さんとの友人関係を解除しますか？お互いの記録が見えなくなります
            </p>
            {rowErrors[confirmTarget.id] ? (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {rowErrors[confirmTarget.id]}
              </p>
            ) : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={pendingUserIds.has(confirmTarget.id)}
                onClick={() => setConfirmTarget(null)}
                className="min-h-11 rounded-xl border border-edge bg-surface px-4 text-sm font-bold text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={pendingUserIds.has(confirmTarget.id)}
                onClick={() => void executeRelationshipMutation(confirmTarget)}
                className="min-h-11 rounded-xl bg-terra px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingUserIds.has(confirmTarget.id) ? '処理中…' : '解除する'}
              </button>
            </div>
          </>
        ) : null}
      </BottomSheet>
      <BottomNav />
    </main>
  )
}
