'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ensureRestaurantAccesses } from '@/lib/restaurants/access'

type GooglePlace = {
  id: string
  displayName: string
  formattedAddress: string | null
}

type Props = {
  places: GooglePlace[]
  query: string
  from: string
}

export default function GoogleCandidatesList({ places, query, from }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleTap(place: GooglePlace) {
    if (resolvingId) return
    setResolvingId(place.id)
    setError(null)

    try {
      const { data: existingId } = await supabase.rpc(
        'resolve_restaurant_by_external_place_id',
        { p_external_place_id: place.id },
      )

      if (existingId) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error('Authentication is required')
        await ensureRestaurantAccesses(supabase, existingId as string, user.id)
        router.push(from === 'record' ? `/record/${existingId}` : `/restaurants/${existingId}`)
      } else {
        const params = new URLSearchParams({
          external_place_id: place.id,
          name: query,
        })
        if (from === 'record') params.set('from', 'record')
        router.push(`/restaurants/new?${params.toString()}`)
      }
    } catch {
      setError('店舗情報の取得に失敗しました。時間をおいて再度お試しください')
      setResolvingId(null)
    }
  }

  return (
    <>
      <ul className="space-y-2" aria-label="Google検索結果">
        {places.map((place) => (
          <li key={place.id}>
            <button
              type="button"
              onClick={() => void handleTap(place)}
              disabled={resolvingId !== null}
              className="flex w-full items-center gap-3 rounded-2xl border border-edge bg-surface px-4 py-3 text-left hover:bg-canvas disabled:opacity-60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#C9A98A"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{place.displayName}</p>
                {place.formattedAddress && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-ink-sub">
                    {place.formattedAddress}
                  </p>
                )}
                <p className="mt-0.5 text-xs font-medium text-terra">
                  {resolvingId === place.id ? '確認中...' : 'このお店を選ぶ →'}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <p className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}
    </>
  )
}
