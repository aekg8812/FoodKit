'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/client'
import { ensureRestaurantAccesses } from '@/lib/restaurants/access'

type RecentRestaurant = {
  id: string
  name: string
  genre: string | null
  area: string | null
  address: string | null
}

type Props = {
  recentRestaurants: RecentRestaurant[]
}

function RestaurantPlaceholder() {
  return (
    <div className="flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    </div>
  )
}

function logSelectError(err: unknown) {
  if (err !== null && typeof err === 'object') {
    const { message, code, details, hint } = err as Record<string, unknown>
    console.error('[RecordSearchClient] select failed', message, code, details, hint)
  } else {
    console.error('[RecordSearchClient] select failed', err)
  }
}

export default function RecordSearchClient({ recentRestaurants }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recentRestaurants
    return recentRestaurants.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.genre ?? '').toLowerCase().includes(q) ||
      (r.area ?? '').toLowerCase().includes(q),
    )
  }, [query, recentRestaurants])

  async function handleSelect(restaurantId: string) {
    if (selectingId) return
    setSelectingId(restaurantId)
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
      setSelectingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-3 text-sm text-ink-sub">記録するお店を選んでください</p>
        <label className="flex items-center gap-2 rounded-full border border-edge bg-surface px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="店名で検索"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-sub"
            autoComplete="off"
          />
        </label>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Recently reviewed stores */}
      {recentRestaurants.length > 0 && (
        <div>
          <h2 className="mb-2 font-black text-ink">最近記録したお店</h2>
          <div className="divide-y divide-edge overflow-hidden rounded-2xl bg-surface">
            {filtered.map((restaurant) => (
              <button
                key={restaurant.id}
                type="button"
                onClick={() => void handleSelect(restaurant.id)}
                disabled={selectingId !== null}
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-canvas disabled:opacity-60"
              >
                <RestaurantPlaceholder />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-terra">{restaurant.name}</p>
                  {(restaurant.genre || restaurant.area) && (
                    <p className="text-xs text-ink-sub">
                      {[restaurant.genre, restaurant.area].filter(Boolean).join('・')}
                    </p>
                  )}
                </div>
                {selectingId === restaurant.id ? (
                  <span className="shrink-0 text-xs text-ink-sub">追加中…</span>
                ) : (
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                    <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
            {query && filtered.length === 0 && (
              <p className="px-4 py-5 text-center text-sm text-ink-sub">
                「{query}」が見つかりません
              </p>
            )}
          </div>
        </div>
      )}

      {/* Not found CTA */}
      <div className="overflow-hidden rounded-2xl bg-[#FFF3EC] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terra/20">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-ink">お店が見つかりませんか？</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-sub">
              FoodKitにまだ登録されていないお店は新しく追加できます
            </p>
          </div>
        </div>
        <Link
          href={`/restaurants/new?from=record${query ? `&name=${encodeURIComponent(query)}` : ''}`}
          className="mt-3 flex h-[48px] items-center justify-center gap-1.5 rounded-full border-2 border-terra text-base font-bold text-terra"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          新しい飲食店を登録
        </Link>
      </div>
    </div>
  )
}
