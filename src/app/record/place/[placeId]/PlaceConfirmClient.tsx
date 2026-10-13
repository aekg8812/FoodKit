'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { createGoogleRestaurantForRecordAction } from './actions'

type Props = {
  placeId: string
  googleHint: string | null
  initialName: string
}

export default function PlaceConfirmClient({ placeId, googleHint, initialName }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setSubmitting(true)
    setError(null)

    const result = await createGoogleRestaurantForRecordAction({ placeId, name: trimmed })

    if (!result.ok) {
      setError(result.error)
      setSubmitting(false)
      return
    }

    router.push(`/record/${result.restaurantId}`)
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Link
          href="/record"
          className="flex h-10 w-10 items-center justify-center text-ink"
          aria-label="戻る"
        >
          <svg
            width="10"
            height="18"
            viewBox="0 0 10 18"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M9 1 L1 9 L9 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-ink">このお店で記録する</h1>
        <div className="w-10" />
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 px-4 pt-5 pb-8">

        {/* Google hint — ephemeral reference only, never stored */}
        {googleHint && (
          <div className="rounded-2xl border border-edge bg-surface px-4 py-3">
            <p className="text-[11px] font-medium text-ink-sub" translate="no">
              Google Maps
            </p>
            <p className="mt-0.5 line-clamp-2 text-sm font-bold text-ink" translate="no">
              {googleHint}
            </p>
          </div>
        )}

        {/* Name input */}
        <div>
          <label htmlFor="place-name" className="mb-1.5 block text-sm font-bold text-ink">
            FoodKitでのお店の名前
            <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-terra text-white">
              必須
            </span>
          </label>
          <input
            id="place-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 100))}
            placeholder="お店の名前を入力してください"
            required
            autoFocus
            className="w-full rounded-2xl border border-edge bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-terra"
            autoComplete="off"
          />
          <p className="mt-1.5 text-xs text-ink-sub">
            FoodKitで記録に使うお店の名前を入力してください
          </p>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        {/* CTA */}
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="flex h-[56px] w-full items-center justify-center rounded-xl bg-terra text-base font-bold text-white disabled:opacity-50"
        >
          {submitting ? '確認中...' : 'このお店で記録する'}
        </button>
      </form>

      <BottomNav />
    </main>
  )
}
