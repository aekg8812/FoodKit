'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/client'
import { ensureRestaurantAccesses } from '@/lib/restaurants/access'

type Props = {
  restaurantId: string
  userId: string
}

function logError(err: unknown) {
  if (err !== null && typeof err === 'object') {
    const { message, code, details, hint } = err as Record<string, unknown>
    console.error('[RestaurantAccessGate] error:', message, code, details, hint)
  } else {
    console.error('[RestaurantAccessGate] error:', err)
  }
}

export default function RestaurantAccessGate({ restaurantId, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    setSubmitting(true)
    setError(null)

    try {
      await ensureRestaurantAccesses(supabase, restaurantId, userId)
      router.refresh()
    } catch (err) {
      logError(err)
      setError('店舗を自分の記録に追加できませんでした。時間をおいて再度お試しください')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <p className="text-sm leading-relaxed text-ink-sub">
        この店舗を自分の記録に追加すると、レビューを書けるようになります。
      </p>
      {error && <div className="mt-4"><ErrorMessage message={error} /></div>}
      <div className="mt-5">
        <Button type="button" onClick={handleAdd} disabled={submitting}>
          {submitting ? '記録に追加中…' : '自分の記録に追加してレビューを書く'}
        </Button>
      </div>
    </div>
  )
}
