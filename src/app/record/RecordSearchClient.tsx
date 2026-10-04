'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ErrorMessage from '@/components/ui/ErrorMessage'
import RestaurantSearchForm from '@/components/restaurants/RestaurantSearchForm'
import { createClient } from '@/lib/supabase/client'
import { ensureRestaurantAccesses } from '@/lib/restaurants/access'

function logSelectError(err: unknown) {
  if (err !== null && typeof err === 'object') {
    const { message, code, details, hint } = err as Record<string, unknown>
    console.error('[RecordSearchClient] select failed', message, code, details, hint)
  } else {
    console.error('[RecordSearchClient] select failed', err)
  }
}

export default function RecordSearchClient() {
  const router = useRouter()
  const supabase = createClient()
  const [error, setError] = useState<string | null>(null)

  async function handleSelect(restaurantId: string) {
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Authentication is required')

      await ensureRestaurantAccesses(supabase, restaurantId, user.id)
      router.push(`/record/${restaurantId}`)
    } catch (err) {
      logSelectError(err)
      setError('店舗を記録に追加できませんでした。時間をおいて再度お試しください')
      // Re-throw so RestaurantSearchForm resets its selectingId (re-enables buttons)
      throw err
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} />
        </div>
      )}
      <RestaurantSearchForm
        onSelect={handleSelect}
        selectLabel="この店舗を選ぶ →"
        newRestaurantBasePath="/restaurants/new?from=record"
      />
    </div>
  )
}
