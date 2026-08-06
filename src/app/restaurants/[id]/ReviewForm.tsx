'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import TextareaField from '@/components/ui/TextareaField'
import InputField from '@/components/ui/InputField'
import ErrorMessage from '@/components/ui/ErrorMessage'

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

const RATING_LABELS: Record<number, string> = {
  4: '常連になりたい',
  3: '機会があればまた行きたい',
  2: '一度行けば十分',
  1: '二度と行かない',
}

const RATING_EMOJI: Record<number, string> = {
  4: '🤩',
  3: '😊',
  2: '😐',
  1: '😞',
}

// アクティブ時は分布バーと同系統の色で一貫性を持たせる
const RATING_ACTIVE_CLASS: Record<number, string> = {
  4: 'bg-emerald-500 text-white border-transparent',
  3: 'bg-sky-400 text-white border-transparent',
  2: 'bg-amber-400 text-white border-transparent',
  1: 'bg-red-400 text-white border-transparent',
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="mb-3 text-sm font-medium text-ink">
          評価 <span className="text-red-500">*</span>
        </p>
        <div className="space-y-2">
          {RATING_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRating(r)}
              className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-150 motion-safe:active:scale-[0.98] ${
                rating === r
                  ? RATING_ACTIVE_CLASS[r]
                  : 'border-edge text-ink hover:bg-canvas'
              }`}
            >
              <span className="w-4 shrink-0 font-bold">{r}</span>
              <span aria-hidden="true">{RATING_EMOJI[r]}</span>
              <span>{RATING_LABELS[r]}</span>
            </button>
          ))}
        </div>
      </div>

      <TextareaField
        id="comment"
        label="コメント"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="感想・おすすめポイントなど（任意）"
      />

      <InputField
        id="visit_date"
        label="最後に行った日"
        type="date"
        value={visitDate}
        onChange={(e) => setVisitDate(e.target.value)}
      />

      {error && <ErrorMessage message={error} />}

      <Button
        type="submit"
        disabled={submitting || rating === null}
      >
        {submitting ? '送信中...' : existingReview ? '更新する' : '投稿する'}
      </Button>
    </form>
  )
}
