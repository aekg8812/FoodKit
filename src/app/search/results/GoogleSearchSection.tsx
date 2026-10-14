'use client'

import { useEffect, useRef, useState } from 'react'
import { readCachedLocation, requestCurrentLocation } from '@/lib/location/client'
import type { CachedLocation } from '@/lib/location/client'
import { createClient } from '@/lib/supabase/client'
import { resolveGooglePlaceIds } from '@/lib/restaurants/resolveGooglePlaces'
import GoogleCandidatesList from './GoogleCandidatesList'
import FoodKitGoogleResultsList, { type FoodKitGooglePlace } from './FoodKitGoogleResultsList'

type GooglePlace = {
  id: string
  displayName: string
  formattedAddress: string | null
}

type SectionState =
  | { kind: 'loading' }
  | {
      kind: 'ready'
      foodkit: FoodKitGooglePlace[]
      googleOnly: GooglePlace[]
      usingCurrentLocation: boolean
      showChip: boolean
    }
  | {
      kind: 'refreshing'
      prevFoodkit: FoodKitGooglePlace[]
      prevGoogleOnly: GooglePlace[]
    }

type Props = {
  query: string
  from: string
  foodkitPlaceIds: string[]
  serverEmpty: boolean
}

async function fetchGooglePlaces(
  query: string,
  coords: CachedLocation | null,
  signal: AbortSignal,
): Promise<GooglePlace[]> {
  const body: Record<string, unknown> = { query }
  if (coords) {
    body.lat = coords.lat
    body.lng = coords.lng
  }
  const res = await fetch('/api/places/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) return []
  const data = (await res.json()) as { places?: GooglePlace[] }
  return data.places ?? []
}

async function resolveAndSplit(
  places: GooglePlace[],
  supabase: ReturnType<typeof createClient>,
  knownFoodkitIds: Set<string>,
): Promise<{ foodkit: FoodKitGooglePlace[]; googleOnly: GooglePlace[] }> {
  if (places.length === 0) return { foodkit: [], googleOnly: [] }

  const placeIds = places.map((p) => p.id).filter((id) => !knownFoodkitIds.has(id))
  const resolveMap = await resolveGooglePlaceIds(placeIds, supabase)

  const foodkit: FoodKitGooglePlace[] = []
  const googleOnly: GooglePlace[] = []

  for (const place of places) {
    if (knownFoodkitIds.has(place.id)) continue

    const r = resolveMap.get(place.id)
    if (r) {
      foodkit.push({ place, restaurantId: r.restaurantId, imageUrl: r.imageUrl })
    } else {
      googleOnly.push(place)
    }
  }

  return { foodkit, googleOnly }
}

export default function GoogleSearchSection({ query, from, foodkitPlaceIds, serverEmpty }: Props) {
  const [state, setState] = useState<SectionState>({ kind: 'loading' })
  const foodkitIdsRef = useRef(new Set(foodkitPlaceIds))
  const chipLoadingRef = useRef(false)
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    const ids = foodkitIdsRef.current

    async function init() {
      const cached = readCachedLocation()
      if (cached) {
        try {
          const places = await fetchGooglePlaces(query, cached, ac.signal)
          if (cancelled) return
          const { foodkit, googleOnly } = await resolveAndSplit(places, supabaseRef.current, ids)
          if (!cancelled) {
            setState({ kind: 'ready', foodkit, googleOnly, usingCurrentLocation: true, showChip: false })
          }
        } catch {
          if (!cancelled) setState({ kind: 'ready', foodkit: [], googleOnly: [], usingCurrentLocation: false, showChip: false })
        }
        return
      }

      type GeoPerm = PermissionState | 'unavailable'
      let permState: GeoPerm = 'unavailable'
      if (typeof navigator !== 'undefined' && navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' })
          permState = result.state
        } catch {
          permState = 'unavailable'
        }
      }

      if (permState === 'granted') {
        try {
          const loc = await requestCurrentLocation()
          if (cancelled) return
          const places = await fetchGooglePlaces(query, loc, ac.signal)
          if (cancelled) return
          const { foodkit, googleOnly } = await resolveAndSplit(places, supabaseRef.current, ids)
          if (!cancelled) {
            setState({ kind: 'ready', foodkit, googleOnly, usingCurrentLocation: true, showChip: false })
          }
        } catch {
          if (cancelled) return
          try {
            const places = await fetchGooglePlaces(query, null, ac.signal)
            if (cancelled) return
            const { foodkit, googleOnly } = await resolveAndSplit(places, supabaseRef.current, ids)
            if (!cancelled) {
              setState({ kind: 'ready', foodkit, googleOnly, usingCurrentLocation: false, showChip: false })
            }
          } catch {
            if (!cancelled) setState({ kind: 'ready', foodkit: [], googleOnly: [], usingCurrentLocation: false, showChip: false })
          }
        }
      } else {
        const showChip = permState !== 'denied'
        try {
          const places = await fetchGooglePlaces(query, null, ac.signal)
          if (cancelled) return
          const { foodkit, googleOnly } = await resolveAndSplit(places, supabaseRef.current, ids)
          if (!cancelled) {
            setState({ kind: 'ready', foodkit, googleOnly, usingCurrentLocation: false, showChip })
          }
        } catch {
          if (!cancelled) setState({ kind: 'ready', foodkit: [], googleOnly: [], usingCurrentLocation: false, showChip })
        }
      }
    }

    void init()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [query]) // supabase and foodkitIdsRef are stable

  async function handleChipClick() {
    if (state.kind !== 'ready' || chipLoadingRef.current) return
    chipLoadingRef.current = true
    const prevFoodkit = state.foodkit
    const prevGoogleOnly = state.googleOnly
    setState({ kind: 'refreshing', prevFoodkit, prevGoogleOnly })

    try {
      const loc = await requestCurrentLocation()
      const places = await fetchGooglePlaces(query, loc, new AbortController().signal)
      const { foodkit, googleOnly } = await resolveAndSplit(places, supabaseRef.current, foodkitIdsRef.current)
      setState({ kind: 'ready', foodkit, googleOnly, usingCurrentLocation: true, showChip: false })
    } catch {
      setState({ kind: 'ready', foodkit: prevFoodkit, googleOnly: prevGoogleOnly, usingCurrentLocation: false, showChip: false })
    } finally {
      chipLoadingRef.current = false
    }
  }

  // Loading skeleton (always shown while resolving — keeps layout stable)
  if (state.kind === 'loading') {
    return (
      <div className="mt-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">その他のお店</h2>
          <span translate="no" className="text-xs font-normal text-ink-sub">Google Maps</span>
        </div>
        <div className="mt-2 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[66px] animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      </div>
    )
  }

  const currentFoodkit = state.kind === 'refreshing' ? state.prevFoodkit : state.foodkit
  const currentGoogleOnly = state.kind === 'refreshing' ? state.prevGoogleOnly : state.googleOnly
  const isRefreshing = state.kind === 'refreshing'
  const showChip = state.kind === 'ready' && state.showChip
  const usingCurrentLocation = state.kind === 'ready' && state.usingCurrentLocation

  // Empty state: no server results AND no Google results
  if (
    serverEmpty &&
    currentFoodkit.length === 0 &&
    currentGoogleOnly.length === 0 &&
    !showChip &&
    !isRefreshing
  ) {
    return (
      <div className="mt-6 flex flex-col items-center text-center">
        <div className="mb-5">
          <svg width="120" height="100" viewBox="0 0 120 100" fill="none" aria-hidden="true">
            <rect x="10" y="50" width="30" height="40" rx="3" fill="#F3E5D8" />
            <rect x="20" y="40" width="40" height="50" rx="3" fill="#EDCFB8" />
            <circle cx="8" cy="58" r="7" fill="#F3E5D8" />
            <rect x="6" y="60" width="4" height="10" fill="#EDCFB8" />
            <circle cx="112" cy="60" r="7" fill="#F3E5D8" />
            <rect x="110" y="62" width="4" height="10" fill="#EDCFB8" />
            <circle cx="60" cy="46" r="28" fill="white" stroke="#E5D4C8" strokeWidth="2" />
            <circle cx="56" cy="42" r="16" fill="white" stroke="#E5D4C8" strokeWidth="3" />
            <rect x="48" y="38" width="16" height="12" rx="2" fill="#F97316" opacity="0.9" />
            <path d="M46 38 Q56 32 66 38" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="53" y="42" width="6" height="8" rx="1" fill="white" />
            <line x1="68" y1="58" x2="80" y2="72" stroke="#E5D4C8" strokeWidth="5" strokeLinecap="round" />
            <line x1="80" y1="22" x2="84" y2="18" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
            <line x1="85" y1="28" x2="91" y2="26" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
            <line x1="78" y1="16" x2="78" y2="10" stroke="#F97316" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-ink">お店が見つかりませんでした</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-sub">
          店名やジャンル、エリアを変えて、
          <br />
          もう一度検索してみてください。
        </p>
      </div>
    )
  }

  return (
    <>
      {/* ── FoodKit Google results ───────────────────────────────────────── */}
      {currentFoodkit.length > 0 && (
        <div className={`mt-6 ${isRefreshing ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="flex items-center justify-between py-3">
            <p className="text-sm font-medium text-ink">FoodKitのお店</p>
          </div>
          <FoodKitGoogleResultsList items={currentFoodkit} from={from} />
        </div>
      )}

      {/* ── Google-only candidates ───────────────────────────────────────── */}
      {(currentGoogleOnly.length > 0 || showChip || isRefreshing) && (
        <div className="mt-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">その他のお店</h2>
            <span translate="no" className="text-xs font-normal text-ink-sub">Google Maps</span>
          </div>

          {/* Location status */}
          <div className="mb-2 min-h-[24px]">
            {showChip && !isRefreshing && (
              <button
                type="button"
                onClick={() => void handleChipClick()}
                className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-ink-sub active:bg-canvas"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="10" r="3" />
                  <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z" />
                </svg>
                現在地周辺を優先する
              </button>
            )}
            {isRefreshing && (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-sub">
                <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                現在地を取得中...
              </span>
            )}
            {usingCurrentLocation && !isRefreshing && (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-sub">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="10" r="3" />
                  <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z" />
                </svg>
                現在地周辺
              </span>
            )}
            {!showChip && !usingCurrentLocation && !isRefreshing && currentGoogleOnly.length > 0 && (
              <span className="text-xs text-ink-sub">飯塚周辺を優先中</span>
            )}
          </div>

          {currentGoogleOnly.length > 0 ? (
            <div className={isRefreshing ? 'pointer-events-none opacity-50' : ''}>
              <GoogleCandidatesList places={currentGoogleOnly} query={query} from={from} />
            </div>
          ) : (
            showChip && (
              <p className="text-sm text-ink-sub">現在地を使って周辺のお店を表示できます</p>
            )
          )}
        </div>
      )}
    </>
  )
}
