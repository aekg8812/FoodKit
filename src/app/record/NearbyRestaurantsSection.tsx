'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { readCachedLocation, requestCurrentLocation } from '@/lib/location/client'
import { resolveGooglePlaceIds } from '@/lib/restaurants/resolveGooglePlaces'
import { ensureRestaurantAccesses } from '@/lib/restaurants/access'

type NearbyItem = {
  placeId: string
  displayName: string
  formattedAddress: string | null
  restaurantId: string | null
  imageUrl: string | null
}

type SectionState =
  | { kind: 'loading' }
  | { kind: 'prompt' }
  | { kind: 'denied' }
  | { kind: 'ready'; items: NearbyItem[] }
  | { kind: 'error' }

type GooglePlace = {
  id: string
  displayName: string
  formattedAddress: string | null
}

async function fetchNearbyPlaces(lat: number, lng: number): Promise<GooglePlace[]> {
  const res = await fetch('/api/places/nearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: lat, longitude: lng }),
  })
  if (!res.ok) throw new Error(`nearby ${res.status}`)
  const data = (await res.json()) as { places?: GooglePlace[] }
  return data.places ?? []
}

function ItemPlaceholder() {
  return (
    <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
      </svg>
    </div>
  )
}

export default function NearbyRestaurantsSection() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const fetchingRef = useRef(false)
  const [state, setState] = useState<SectionState>({ kind: 'loading' })
  const [tappingId, setTappingId] = useState<string | null>(null)
  const [tapError, setTapError] = useState<string | null>(null)

  async function buildItems(places: GooglePlace[]): Promise<NearbyItem[]> {
    const resolveMap = await resolveGooglePlaceIds(
      places.map((p) => p.id),
      supabaseRef.current,
    )
    return places.map((p) => {
      const r = resolveMap.get(p.id)
      return {
        placeId: p.id,
        displayName: p.displayName,
        formattedAddress: p.formattedAddress,
        restaurantId: r ? r.restaurantId : null,
        imageUrl: r ? r.imageUrl : null,
      }
    })
  }

  async function doFetch(lat: number, lng: number) {
    fetchingRef.current = true
    setState({ kind: 'loading' })
    try {
      const places = await fetchNearbyPlaces(lat, lng)
      const items = await buildItems(places)
      setState({ kind: 'ready', items })
    } catch {
      setState({ kind: 'error' })
    } finally {
      fetchingRef.current = false
    }
  }

  useEffect(() => {
    let cancelled = false

    async function init() {
      // Guard against Strict Mode double-invoke and any other duplicate mounts
      if (fetchingRef.current) return

      // Use cached coords silently if available
      const cached = readCachedLocation()
      if (cached) {
        if (!cancelled) await doFetch(cached.lat, cached.lng)
        return
      }

      // Check permission state without triggering a dialog
      let permState: PermissionState | 'unavailable' = 'unavailable'
      if (typeof navigator !== 'undefined' && navigator.permissions) {
        try {
          const p = await navigator.permissions.query({ name: 'geolocation' })
          permState = p.state
        } catch {
          permState = 'unavailable'
        }
      }

      if (cancelled) return

      if (permState === 'granted') {
        try {
          const loc = await requestCurrentLocation()
          if (!cancelled) await doFetch(loc.lat, loc.lng)
        } catch {
          if (!cancelled) setState({ kind: 'error' })
        }
      } else if (permState === 'denied') {
        setState({ kind: 'denied' })
      } else {
        setState({ kind: 'prompt' })
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGrantClick() {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setState({ kind: 'loading' })
    try {
      const loc = await requestCurrentLocation()
      const places = await fetchNearbyPlaces(loc.lat, loc.lng)
      const items = await buildItems(places)
      setState({ kind: 'ready', items })
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 1) {
        setState({ kind: 'denied' })
      } else {
        setState({ kind: 'error' })
      }
    } finally {
      fetchingRef.current = false
    }
  }

  async function handleRetry() {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setState({ kind: 'loading' })
    try {
      const cached = readCachedLocation()
      const loc = cached ?? (await requestCurrentLocation())
      const places = await fetchNearbyPlaces(loc.lat, loc.lng)
      const items = await buildItems(places)
      setState({ kind: 'ready', items })
    } catch {
      setState({ kind: 'error' })
    } finally {
      fetchingRef.current = false
    }
  }

  async function handleTap(item: NearbyItem) {
    if (tappingId) return
    setTappingId(item.placeId)
    setTapError(null)

    try {
      if (item.restaurantId) {
        const {
          data: { user },
        } = await supabaseRef.current.auth.getUser()
        if (!user) throw new Error('Not authenticated')
        await ensureRestaurantAccesses(supabaseRef.current, item.restaurantId, user.id)
        router.push(`/record/${item.restaurantId}`)
      } else {
        router.push(`/record/place/${encodeURIComponent(item.placeId)}`)
      }
    } catch {
      setTapError('店舗情報の取得に失敗しました。時間をおいて再度お試しください')
      setTappingId(null)
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-black text-ink">近くのお店</h2>
        <span translate="no" className="text-xs font-normal text-ink-sub">Google Maps</span>
      </div>

      {/* Loading skeleton */}
      {state.kind === 'loading' && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      )}

      {/* Prompt: user hasn't granted location yet */}
      {state.kind === 'prompt' && (
        <div className="rounded-2xl border border-edge bg-surface px-5 py-6 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3" aria-hidden="true">
            <circle cx="12" cy="10" r="3" />
            <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z" />
          </svg>
          <p className="text-sm font-medium text-ink">現在地を使って近くのお店を表示</p>
          <p className="mt-1 text-xs text-ink-sub">現在地から近い順に飲食店を表示します</p>
          <button
            type="button"
            onClick={() => void handleGrantClick()}
            className="mt-4 flex h-[44px] w-full items-center justify-center rounded-full bg-terra text-sm font-bold text-white active:opacity-80"
          >
            現在地を使う
          </button>
        </div>
      )}

      {/* Denied: location permission refused */}
      {state.kind === 'denied' && (
        <div className="rounded-2xl border border-edge bg-surface px-5 py-5 text-center">
          <p className="text-sm text-ink-sub">現在地を利用できません</p>
          <p className="mt-1 text-xs text-ink-sub">
            ブラウザの設定から位置情報の許可をオンにしてください
          </p>
        </div>
      )}

      {/* Error: fetch failed */}
      {state.kind === 'error' && (
        <div className="rounded-2xl border border-edge bg-surface px-5 py-5 text-center">
          <p className="text-sm text-ink-sub">周辺のお店を取得できませんでした</p>
          <button
            type="button"
            onClick={() => void handleRetry()}
            className="mt-3 text-sm font-medium text-terra"
          >
            再試行
          </button>
        </div>
      )}

      {/* Ready */}
      {state.kind === 'ready' && (
        <>
          {tapError && (
            <p className="mb-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{tapError}</p>
          )}

          {state.items.length === 0 ? (
            <div className="rounded-2xl border border-edge bg-surface px-5 py-6 text-center">
              <p className="text-sm text-ink-sub">現在地周辺に飲食店が見つかりませんでした</p>
            </div>
          ) : (
            <div className="divide-y divide-edge overflow-hidden rounded-2xl bg-surface">
              {state.items.map((item) => (
                <button
                  key={item.placeId}
                  type="button"
                  onClick={() => void handleTap(item)}
                  disabled={tappingId !== null}
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-canvas disabled:opacity-60"
                >
                  {item.imageUrl ? (
                    <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={item.imageUrl}
                        alt={item.displayName}
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <ItemPlaceholder />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink">{item.displayName}</p>
                    {item.formattedAddress && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-ink-sub">
                        {item.formattedAddress}
                      </p>
                    )}
                  </div>

                  {tappingId === item.placeId ? (
                    <svg className="animate-spin shrink-0 text-ink-sub" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                  ) : (
                    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                      <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
