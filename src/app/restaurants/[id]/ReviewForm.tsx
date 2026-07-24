'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export type ExistingReview = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
}

interface Props {
  restaurantId: string
  groupId: string
  existingReview: ExistingReview | null
}

export const RATING_OPTIONS = [4, 3, 2, 1] as const

export const RATING_LABELS: Record<number, string> = {
  4: '常連になりたい',
  3: '機会があればまた行きたい',
  2: '一度行けば十分',
  1: '二度と行かない',
}

function logError(err: unknown) {
  if (err !== null && typeof err === 'object') {
    const { message, code, details, hint } = err as Record<string, unknown>
    console.error('[ReviewForm] error:', { message, code, details, hint })
  } else {
    console.error('[ReviewForm] error:', err)
  }
}

function toJapaneseError(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : err !== null && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : ''
  if (msg.includes('Authentication is required')) return 'ログインが必要です。再度ログインしてください'
  return 'エラーが発生しました。時間をおいて再度お試しください'
}

export default function ReviewForm({ restaurantId, groupId, existingReview }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [rating, setRating] = useState<number | null>(existingReview?.rating ?? null)
  const [comment, setComment] = useState(existingReview?.comment ?? '')
  const [visitDate, setVisitDate] = useState(existingReview?.visit_date ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (rating === null || rating < 1 || rating > 4) return
    setSubmitting(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Authentication is required')

      const payload = {
        rating,
        comment: comment.trim() || null,
        visit_date: visitDate || null,
      }

      if (existingReview) {
        // TODO (V0): Replace with ON CONFLICT DO UPDATE once UNIQUE(user_id, restaurant_id) is added.
        const { error: updateError } = await supabase
          .from('reviews')
          .update(payload)
          .eq('id', existingReview.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('reviews')
          .insert({
            ...payload,
            restaurant_id: restaurantId,
            user_id: user.id,
            group_id: groupId,
            visibility: 'group',
          })
        if (insertError) throw insertError
      }

      router.refresh()
    } catch (err) {
      logError(err)
      setError(toJapaneseError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">
          評価 <span className="text-red-500">*</span>
        </p>
        <div className="space-y-2">
          {RATING_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRating(r)}
              className={
                rating === r
                  ? 'flex w-full items-center gap-3 rounded-lg bg-zinc-950 px-4 py-3 text-left text-sm text-white'
                  : 'flex w-full items-center gap-3 rounded-lg border border-zinc-300 px-4 py-3 text-left text-sm text-zinc-700 hover:bg-zinc-50'
              }
            >
              <span className="w-4 shrink-0 font-bold">{r}</span>
              <span>{RATING_LABELS[r]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="comment" className="block text-sm font-medium text-zinc-700">
          コメント
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
          placeholder="感想・おすすめポイントなど（任意）"
        />
      </div>

      <div>
        <label htmlFor="visit_date" className="block text-sm font-medium text-zinc-700">
          最後に行った日
        </label>
        <input
          id="visit_date"
          type="date"
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || rating === null}
        className="w-full rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        {submitting ? '送信中...' : existingReview ? '更新する' : '投稿する'}
      </button>
    </form>
  )
}
