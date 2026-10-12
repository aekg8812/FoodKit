'use client'

import { useEffect, useRef, useState } from 'react'
import { readCachedLocation, requestCurrentLocation } from '@/lib/location/client'
import type { CachedLocation } from '@/lib/location/client'
import GoogleCandidatesList from './GoogleCandidatesList'

type GooglePlace = {
  id: string
  displayName: string
  formattedAddress: string | null
}

type SectionState =
  | { kind: 'loading' }
  | {
      kind: 'ready'
      places: GooglePlace[]
      usingCurrentLocation: boolean
      showChip: boolean
    }
  | { kind: 'refreshing'; prevPlaces: GooglePlace[] }

type Props = {
  query: string
  from: string
  foodkitPlaceIds: string[]
}

function dedupPlaces(places: GooglePlace[], ids: Set<string>): GooglePlace[] {
  return places.filter((p) => !ids.has(p.id))
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

export default function GoogleSearchSection({ query, from, foodkitPlaceIds }: Props) {
  const [state, setState] = useState<SectionState>({ kind: 'loading' })
  const foodkitIdsRef = useRef(new Set(foodkitPlaceIds))
  const chipLoadingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    const ids = foodkitIdsRef.current

    async function init() {
      // 1. Check session cache
      const cached = readCachedLocation()
      if (cached) {
        try {
          const places = await fetchGooglePlaces(query, cached, ac.signal)
          if (!cancelled) {
            setState({
              kind: 'ready',
              places: dedupPlaces(places, ids),
              usingCurrentLocation: true,
              showChip: false,
            })
          }
        } catch {
          if (!cancelled) {
            setState({ kind: 'ready', places: [], usingCurrentLocation: false, showChip: false })
          }
        }
        return
      }

      // 2. Check permission state without triggering a dialog
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
        // Already permitted — silent request, no dialog
        try {
          const loc = await requestCurrentLocation()
          if (cancelled) return
          const places = await fetchGooglePlaces(query, loc, ac.signal)
          if (!cancelled) {
            setState({
              kind: 'ready',
              places: dedupPlaces(places, ids),
              usingCurrentLocation: true,
              showChip: false,
            })
          }
        } catch {
          if (cancelled) return
          // Geolocation timed out or failed → Iizuka fallback, no chip
          try {
            const places = await fetchGooglePlaces(query, null, ac.signal)
            if (!cancelled) {
              setState({
                kind: 'ready',
                places: dedupPlaces(places, ids),
                usingCurrentLocation: false,
                showChip: false,
              })
            }
          } catch {
            if (!cancelled) {
              setState({ kind: 'ready', places: [], usingCurrentLocation: false, showChip: false })
            }
          }
        }
      } else {
        // 'prompt', 'denied', 'unavailable'
        // Never call getCurrentPosition here — show chip for prompt/unavailable
        const showChip = permState !== 'denied'
        try {
          const places = await fetchGooglePlaces(query, null, ac.signal)
          if (!cancelled) {
            setState({
              kind: 'ready',
              places: dedupPlaces(places, ids),
              usingCurrentLocation: false,
              showChip,
            })
          }
        } catch {
          if (!cancelled) {
            setState({ kind: 'ready', places: [], usingCurrentLocation: false, showChip })
          }
        }
      }
    }

    void init()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [query]) // foodkitIdsRef is stable — no need in deps

  async function handleChipClick() {
    if (state.kind !== 'ready' || chipLoadingRef.current) return
    chipLoadingRef.current = true
    const prevPlaces = state.places
    setState({ kind: 'refreshing', prevPlaces })

    try {
      const loc = await requestCurrentLocation()
      const places = await fetchGooglePlaces(query, loc, new AbortController().signal)
      setState({
        kind: 'ready',
        places: dedupPlaces(places, foodkitIdsRef.current),
        usingCurrentLocation: true,
        showChip: false,
      })
    } catch {
      // Permission denied or timeout — revert, hide chip (user has decided)
      setState({ kind: 'ready', places: prevPlaces, usingCurrentLocation: false, showChip: false })
    } finally {
      chipLoadingRef.current = false
    }
  }

  // Loading skeleton
  if (state.kind === 'loading') {
    return (
      <div className="mt-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">その他のお店</h2>
          <span translate="no" className="text-xs font-normal text-ink-sub">
            Google Maps
          </span>
        </div>
        <div className="mt-2 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[66px] animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      </div>
    )
  }

  const currentPlaces = state.kind === 'refreshing' ? state.prevPlaces : state.places
  const isRefreshing = state.kind === 'refreshing'
  const showChip = state.kind === 'ready' && state.showChip
  const usingCurrentLocation = state.kind === 'ready' && state.usingCurrentLocation

  if (currentPlaces.length === 0 && !showChip && !isRefreshing) return null

  return (
    <div className="mt-6">
      {/* Header row: title + Google Maps attribution */}
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">その他のお店</h2>
        <span translate="no" className="text-xs font-normal text-ink-sub">
          Google Maps
        </span>
      </div>

      {/* Location status row — separate line from header */}
      <div className="mb-2 min-h-[24px]">
        {showChip && !isRefreshing && (
          <button
            type="button"
            onClick={() => void handleChipClick()}
            className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-ink-sub active:bg-canvas"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="10" r="3" />
              <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z" />
            </svg>
            現在地周辺を優先する
          </button>
        )}
        {isRefreshing && (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-sub">
            <svg
              className="animate-spin"
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            現在地を取得中...
          </span>
        )}
        {usingCurrentLocation && !isRefreshing && (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-sub">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="10" r="3" />
              <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z" />
            </svg>
            現在地周辺
          </span>
        )}
        {!showChip && !usingCurrentLocation && !isRefreshing && currentPlaces.length > 0 && (
          <span className="text-xs text-ink-sub">飯塚周辺を優先中</span>
        )}
      </div>

      {/* Results */}
      {currentPlaces.length > 0 ? (
        <div className={isRefreshing ? 'pointer-events-none opacity-50' : ''}>
          <GoogleCandidatesList places={currentPlaces} query={query} from={from} />
        </div>
      ) : (
        showChip && (
          <p className="text-sm text-ink-sub">現在地を使って周辺のお店を表示できます</p>
        )
      )}
    </div>
  )
}
