'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { followUser, unfollowUser } from '@/lib/follows/mutations'
import { createClient } from '@/lib/supabase/client'

export type FollowRelationship = 'self' | 'mutual' | 'outgoing' | 'incoming' | 'none'

type ProfileActionsProps = {
  viewerId: string
  profileUserId: string
  initialRelationship: FollowRelationship
  isOwnMypage?: boolean
}

const ACTION_LINK_CLASS =
  'inline-flex min-h-[44px] items-center justify-center rounded-full border border-edge bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas'

export default function ProfileActions({
  viewerId,
  profileUserId,
  initialRelationship,
  isOwnMypage = false,
}: ProfileActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (initialRelationship === 'self') {
    return (
      <div
        className={
          isOwnMypage
            ? 'grid grid-cols-1 gap-2 sm:grid-cols-4'
            : 'grid grid-cols-1 gap-2 sm:grid-cols-5'
        }
      >
        <Link href="/mypage/preferences" className={ACTION_LINK_CLASS}>
          再診断
        </Link>
        <Link href="/mypage/reviews" className={ACTION_LINK_CLASS}>
          記録帳
        </Link>
        <Link href="/settings" className={ACTION_LINK_CLASS}>
          設定
        </Link>
        <Link href="/restaurants/search" className={ACTION_LINK_CLASS}>
          店舗を記録する
        </Link>
        {!isOwnMypage ? (
          <Link href="/mypage" className={ACTION_LINK_CLASS}>
            マイページへ
          </Link>
        ) : null}
      </div>
    )
  }

  async function handleFollow() {
    setLoading(true)
    setErrorMessage(null)

    const result = await followUser(createClient(), viewerId, profileUserId)
    if (!result.ok) {
      setErrorMessage(result.message)
      setLoading(false)
      return
    }

    setLoading(false)
    router.refresh()
  }

  async function handleUnfollow() {
    setLoading(true)
    setErrorMessage(null)

    const result = await unfollowUser(createClient(), viewerId, profileUserId)
    if (!result.ok) {
      setErrorMessage(result.message)
      setLoading(false)
      return
    }

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {initialRelationship === 'mutual' ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <span className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-cream px-5 text-sm font-medium text-amber-800">
            友人 ✓
          </span>
          <button
            type="button"
            onClick={handleUnfollow}
            disabled={loading}
            className="min-h-[44px] rounded-full border border-edge bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '処理中…' : '友人から削除'}
          </button>
        </div>
      ) : initialRelationship === 'outgoing' ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <span className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-canvas px-5 text-sm font-medium text-ink-sub">
            フォロー中
          </span>
          <button
            type="button"
            onClick={handleUnfollow}
            disabled={loading}
            className="min-h-[44px] rounded-full border border-edge bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '処理中…' : 'フォロー解除'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleFollow}
          disabled={loading}
          className="min-h-[44px] w-full rounded-full bg-terra px-5 text-sm font-medium text-white transition-colors hover:bg-terra-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? '処理中…'
            : initialRelationship === 'incoming'
              ? 'フォローバック'
              : 'フォロー'}
        </button>
      )}

      {errorMessage ? (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
