'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomSheet from '@/components/ui/BottomSheet'
import { createClient } from '@/lib/supabase/client'
import { followUser, unfollowUser } from '@/lib/follows/mutations'

export type FriendRelationshipActionType =
  | 'follow-back'
  | 'remove-friend'
  | 'unfollow'

type FriendRelationshipActionProps = {
  viewerId: string
  profile: {
    id: string
    name: string
  }
  action: FriendRelationshipActionType
}

const UNEXPECTED_ERROR_MESSAGE = 'フォロー操作に失敗しました。もう一度お試しください。'

export default function FriendRelationshipAction({
  viewerId,
  profile,
  action,
}: FriendRelationshipActionProps) {
  const router = useRouter()
  const inFlightRef = useRef(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const needsConfirmation = action !== 'follow-back'
  const buttonLabel =
    action === 'follow-back'
      ? 'フォローバック'
      : action === 'remove-friend'
        ? '友人から削除'
        : 'フォロー解除'
  const confirmTitle = action === 'remove-friend' ? '友人関係を解除' : 'フォローを解除'
  const confirmMessage =
    action === 'remove-friend'
      ? `${profile.name}さんとの友人関係を解除しますか？お互いの記録が見えなくなります`
      : `${profile.name}さんのフォローを解除しますか？フォロー中の一覧から表示されなくなります`

  async function executeAction() {
    if (inFlightRef.current) return

    inFlightRef.current = true
    setLoading(true)
    setErrorMessage(null)

    try {
      const supabase = createClient()
      const result =
        action === 'follow-back'
          ? await followUser(supabase, viewerId, profile.id)
          : await unfollowUser(supabase, viewerId, profile.id)

      if (!result.ok) {
        setErrorMessage(result.message)
        return
      }

      if (needsConfirmation) setConfirmOpen(false)
      router.refresh()
    } catch (error) {
      console.error('FriendRelationshipAction failed', error)
      setErrorMessage(UNEXPECTED_ERROR_MESSAGE)
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }

  return (
    <>
      <div className="shrink-0 text-right">
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            if (needsConfirmation) {
              setErrorMessage(null)
              setConfirmOpen(true)
              return
            }
            void executeAction()
          }}
          className="min-h-11 rounded-full border border-edge bg-surface px-3 text-xs font-bold text-terra transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '処理中…' : buttonLabel}
        </button>
        {!needsConfirmation && errorMessage ? (
          <p role="alert" className="mt-1 max-w-32 text-left text-xs text-red-600">
            {errorMessage}
          </p>
        ) : null}
      </div>

      {needsConfirmation ? (
        <BottomSheet
          id={`friend-action-${action}-${profile.id}`}
          open={confirmOpen}
          title={confirmTitle}
          onClose={() => setConfirmOpen(false)}
        >
          <p className="text-sm leading-6 text-ink-sub">{confirmMessage}</p>
          {errorMessage ? (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {errorMessage}
            </p>
          ) : null}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => setConfirmOpen(false)}
              className="min-h-11 rounded-xl border border-edge bg-surface px-4 text-sm font-bold text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void executeAction()}
              className="min-h-11 rounded-xl bg-terra px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '処理中…' : '解除する'}
            </button>
          </div>
        </BottomSheet>
      ) : null}
    </>
  )
}
