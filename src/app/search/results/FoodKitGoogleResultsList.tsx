'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ensureRestaurantAccesses } from '@/lib/restaurants/access'
import RestaurantMainImage from '@/components/RestaurantMainImage'

export type FoodKitGooglePlace = {
  place: {
    id: string
    displayName: string
    formattedAddress: string | null
  }
  restaurantId: string
  imageUrl: string | null
}

type Props = {
  items: FoodKitGooglePlace[]
  from: string
}

export default function FoodKitGoogleResultsList({ items, from }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleTap(item: FoodKitGooglePlace) {
    if (resolvingId) return
    setResolvingId(item.place.id)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Authentication required')

      await ensureRestaurantAccesses(supabase, item.restaurantId, user.id)
      router.push(from === 'record' ? `/record/${item.restaurantId}` : `/restaurants/${item.restaurantId}`)
    } catch {
      setError('店舗情報の取得に失敗しました。時間をおいて再度お試しください')
      setResolvingId(null)
    }
  }

  return (
    <>
      <ul className="space-y-3" aria-label="FoodKit検索結果（Google登録）">
        {items.map((item) => (
          <li key={item.place.id}>
            <button
              type="button"
              onClick={() => void handleTap(item)}
              disabled={resolvingId !== null}
              className="flex w-full overflow-hidden rounded-2xl bg-surface disabled:opacity-60"
            >
              <div className="relative h-[130px] w-[110px] shrink-0 overflow-hidden">
                <RestaurantMainImage src={item.imageUrl} alt={item.place.displayName} />
              </div>

              <div className="flex flex-1 flex-col justify-between p-3 text-left">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-ink" translate="no">
                      {resolvingId === item.place.id ? '確認中...' : item.place.displayName}
                    </p>
                    <svg
                      width="8"
                      height="14"
                      viewBox="0 0 8 14"
                      fill="none"
                      className="mt-0.5 shrink-0 text-ink-sub"
                      aria-hidden="true"
                    >
                      <path
                        d="M1 1l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  {item.place.formattedAddress && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-ink-sub" translate="no">
                      {item.place.formattedAddress}
                    </p>
                  )}
                </div>

                <div className="mt-2 rounded-lg bg-[#FFF3EC] px-2.5 py-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-terra">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="shrink-0"
                      aria-hidden="true"
                    >
                      <path
                        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                        stroke="#F97316"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <circle cx="9" cy="7" r="4" stroke="#F97316" strokeWidth="2" />
                      <path
                        d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                        stroke="#F97316"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    FoodKitユーザーが記録中
                  </p>
                </div>
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
