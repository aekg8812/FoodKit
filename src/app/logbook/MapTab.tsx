'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { RATING_LABELS, RATING_BG, RATING_TEXT, RATING_BORDER } from '@/lib/rating/colors'
import type { MapPin, MapPersonalStats, MapGroupInfo } from './types'

// ── Env ──────────────────────────────────────────────────────────────────────

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
const MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? ''

// ── Types ────────────────────────────────────────────────────────────────────

type Mode = 'personal' | 'group'
type MapStatus = 'idle' | 'loading' | 'ready' | 'error' | 'no_key'

type GroupStats = {
  groupId: string
  memberCount: number
  uniqueRestaurantCount: number
  totalVisitCount: number
  isGroupSharingLimited: boolean
}

// ── Custom orange drop-pin element ───────────────────────────────────────────

function createPinElement(selected: boolean): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = [
    `width:36px;height:42px;cursor:pointer;`,
    `filter:drop-shadow(0 2px 4px rgba(98,55,31,${selected ? '0.35' : '0.22'}));`,
    `transform:${selected ? 'scale(1.18)' : 'scale(1)'};`,
    `transform-origin:bottom center;`,
    `transition:transform 0.15s ease;`,
  ].join('')
  el.innerHTML = `
    <svg width="36" height="42" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M18 2C10.268 2 4 8.268 4 16c0 9.6 14 24 14 24s14-14.4 14-24c0-7.732-6.268-14-14-14z"
        fill="${selected ? '#ea6c00' : '#F97316'}" stroke="white" stroke-width="2.5"/>
      <circle cx="18" cy="16" r="8" fill="white" fill-opacity="0.15"/>
      <g transform="translate(10, 9)" stroke="white" stroke-width="1.6" stroke-linecap="round">
        <line x1="4" y1="2" x2="4" y2="13"/>
        <line x1="4" y1="2" x2="2" y2="4"/>
        <line x1="4" y1="2" x2="6" y2="4"/>
        <line x1="4" y1="8" x2="2" y2="6"/>
        <line x1="4" y1="8" x2="6" y2="6"/>
        <line x1="12" y1="2" x2="12" y2="5" stroke-width="1.4"/>
        <line x1="10" y1="2" x2="10" y2="5"/>
        <line x1="14" y1="2" x2="14" y2="5"/>
        <path d="M10 5 Q10 8 12 8 Q14 8 14 5"/>
        <line x1="12" y1="8" x2="12" y2="13"/>
      </g>
    </svg>
  `
  return el
}

function createClusterElement(count: number): HTMLElement {
  const size = count >= 20 ? 52 : count >= 10 ? 46 : 40
  const el = document.createElement('div')
  el.style.cssText = [
    `width:${size}px;height:${size}px;cursor:pointer;`,
    `border-radius:50%;background:#F97316;`,
    `border:2.5px solid white;`,
    `box-shadow:0 0 0 4px rgba(249,115,22,0.22),0 2px 6px rgba(98,55,31,0.25);`,
    `display:flex;align-items:center;justify-content:center;`,
    `color:white;font-weight:800;font-size:${count >= 10 ? 15 : 17}px;`,
    `font-family:system-ui,sans-serif;`,
  ].join('')
  el.textContent = String(count)
  return el
}

// ── Build Google Maps directions URL ─────────────────────────────────────────

function buildDirectionsUrl(pin: MapPin): string | null {
  if (pin.externalPlaceId) {
    const name = encodeURIComponent(pin.name)
    const pid = encodeURIComponent(pin.externalPlaceId)
    return `https://www.google.com/maps/dir/?api=1&destination=${name}&destination_place_id=${pid}&dir_action=navigate`
  }
  if (pin.address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pin.address)}&dir_action=navigate`
  }
  if (pin.lat !== null && pin.lng !== null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}&dir_action=navigate`
  }
  return null
}

// ── Stat card item ───────────────────────────────────────────────────────────

function StatItem({
  icon, label, value, unit,
}: {
  icon: React.ReactNode
  label: string
  value: number
  unit: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-0.5 py-3.5">
      <div className="mb-0.5">{icon}</div>
      <p className="text-[11px] font-semibold text-ink-sub">{label}</p>
      <p className="text-[23px] font-extrabold tabular-nums text-ink leading-none">
        {value}<span className="ml-0.5 text-xs font-semibold">{unit}</span>
      </p>
    </div>
  )
}

// ── Preview card ─────────────────────────────────────────────────────────────

function MapPreviewCard({
  pin,
  mode,
  selectedGroup,
  onClose,
}: {
  pin: MapPin
  mode: Mode
  selectedGroup: MapGroupInfo | null
  onClose: () => void
}) {
  const directionsUrl = buildDirectionsUrl(pin)

  return (
    <div
      className="absolute bottom-0 left-2 right-2 z-10 rounded-t-[20px] rounded-b-2xl border border-edge bg-surface pb-3 pt-1 shadow-[0_-4px_16px_rgba(98,55,31,0.10)]"
      role="region"
      aria-label={`${pin.name}の店舗情報`}
    >
      {/* Drag handle */}
      <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-edge" aria-hidden="true" />

      {/* Top content row */}
      <div className="flex gap-3 px-3">
        {/* Photo */}
        <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[12px] bg-[#F3E5D8]">
          {pin.latestImageSigned ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pin.latestImageSigned}
              alt={pin.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C49A80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <p className="line-clamp-2 text-[16px] font-bold leading-snug text-ink">{pin.name}</p>
            <span
              className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${RATING_BG[pin.latestRating]} ${RATING_TEXT[pin.latestRating]} ${RATING_BORDER[pin.latestRating]}`}
            >
              {RATING_LABELS[pin.latestRating]}
            </span>
          </div>

          {/* Group name (group mode) */}
          {mode === 'group' && selectedGroup && (
            <div className="mt-1 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <p className="truncate text-[12px] text-ink-sub">{selectedGroup.name}</p>
            </div>
          )}

          <p className="mt-0.5 text-[12px] text-ink-sub">
            合計{pin.visitCount}回来店
          </p>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="ml-1 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-edge bg-canvas text-ink-sub"
          aria-label="閉じる"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex gap-2 px-3">
        <Link
          href={`/mypage/records/${pin.restaurantId}`}
          className="flex flex-[42] items-center justify-center gap-1.5 rounded-[12px] border border-terra/50 bg-canvas py-3 text-[13px] font-bold text-terra"
        >
          来店履歴を見る
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>

        {directionsUrl ? (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-[58] items-center justify-center gap-1 rounded-[12px] bg-terra py-3 text-[12px] font-bold text-white"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            Googleマップで経路案内
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        ) : (
          <span className="flex flex-[58] items-center justify-center rounded-[12px] bg-edge/50 py-3 text-[12px] font-semibold text-ink-sub/60">
            位置情報未設定
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main MapTab ───────────────────────────────────────────────────────────────

export default function MapTab() {
  const [mode, setMode] = useState<Mode>('personal')
  const [pins, setPins] = useState<MapPin[]>([])
  const [personalStats, setPersonalStats] = useState<MapPersonalStats | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)

  const [groups, setGroups] = useState<MapGroupInfo[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [groupStats, setGroupStats] = useState<GroupStats | null>(null)

  const [mapStatus, setMapStatus] = useState<MapStatus>(!MAPS_API_KEY ? 'no_key' : 'idle')
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null)
  const [noLocationCount, setNoLocationCount] = useState(0)
  // Incremented to trigger a fresh initialization attempt (e.g. after error).
  const [retryKey, setRetryKey] = useState(0)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const clustererRef = useRef<import('@googlemaps/markerclusterer').MarkerClusterer | null>(null)
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map())
  const selectedPinIdRef = useRef<string | null>(null)

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null
  const currentGroupStats = groupStats?.groupId === selectedGroupId ? groupStats : null
  const isGroupStatsLoading = mode === 'group' && selectedGroupId !== null && currentGroupStats === null

  // ── Personal data fetch (on mount) ───────────────────────────────────────

  useEffect(() => {
    let active = true
    fetch('/api/logbook/map/personal')
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { pins: MapPin[]; stats: MapPersonalStats }) => {
        if (!active) return
        setPins(data.pins)
        setPersonalStats(data.stats)
        setNoLocationCount(data.pins.filter((p) => !p.hasLocation).length)
        setDataLoading(false)
      })
      .catch(() => {
        if (!active) return
        setDataError('来店データの読み込みに失敗しました')
        setDataLoading(false)
      })
    return () => { active = false }
  }, [])

  // ── Marker click handler (defined before updateMarkers effect) ────────────

  const handleMarkerClick = useCallback((pin: MapPin, marker: google.maps.marker.AdvancedMarkerElement) => {
    if (selectedPinIdRef.current) {
      const prevMarker = markersRef.current.get(selectedPinIdRef.current)
      if (prevMarker) prevMarker.content = createPinElement(false)
    }
    marker.content = createPinElement(true)
    selectedPinIdRef.current = pin.restaurantId
    setSelectedPin(pin)

    // Pan pin into view above preview card
    if (mapInstanceRef.current && pin.lat !== null && pin.lng !== null) {
      const map = mapInstanceRef.current
      const zoom = map.getZoom() ?? 13
      const proj = map.getProjection()
      if (proj) {
        const target = new google.maps.LatLng(pin.lat, pin.lng)
        const pt = proj.fromLatLngToPoint(target)
        if (pt) {
          const scale = Math.pow(2, zoom)
          const newPt = new google.maps.Point(pt.x, pt.y + 160 / scale)
          const newLatLng = proj.fromPointToLatLng(newPt)
          if (newLatLng) map.panTo(newLatLng)
        }
      }
    }
  }, [])

  const handleClosePreview = useCallback(() => {
    if (selectedPinIdRef.current) {
      const prev = markersRef.current.get(selectedPinIdRef.current)
      if (prev) prev.content = createPinElement(false)
    }
    selectedPinIdRef.current = null
    setSelectedPin(null)
  }, [])

  // ── Google Maps initialization ────────────────────────────────────────────
  // Dependency: retryKey only — not mapStatus.
  // Using mapStatus as a dependency would cause the cleanup to fire whenever
  // setMapStatus('loading') is called inside the effect, which cancels the
  // in-flight async init and leaves mapStatus stuck at 'loading' forever.
  // retryKey is incremented only on explicit retry, so the effect is stable
  // during normal initialization and handles React Strict Mode correctly via
  // the cancelled flag alone (no mapInitAttemptedRef needed).

  useEffect(() => {
    if (!MAPS_API_KEY || !mapContainerRef.current) return

    setMapStatus('loading')
    let cancelled = false

    async function initMap() {
      const { setOptions, importLibrary } = await import('@googlemaps/js-api-loader')
      if (cancelled || !mapContainerRef.current) return
      setOptions({ key: MAPS_API_KEY, v: 'weekly' })
      await importLibrary('maps')
      await importLibrary('marker')
      if (cancelled || !mapContainerRef.current) return

      const map = new google.maps.Map(mapContainerRef.current, {
        mapId: MAPS_MAP_ID || undefined,
        center: { lat: 33.6427, lng: 130.6909 },
        zoom: 13,
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
      })
      mapInstanceRef.current = map
      if (!cancelled) setMapStatus('ready')
    }

    void initMap().catch(() => {
      if (!cancelled) setMapStatus('error')
    })

    return () => { cancelled = true }
  }, [retryKey])

  // ── Update markers when pins or mapStatus changes ─────────────────────────

  useEffect(() => {
    if (mapStatus !== 'ready' || !mapInstanceRef.current) return

    const map = mapInstanceRef.current
    const locatedPins = pins.filter((p) => p.hasLocation && p.lat !== null && p.lng !== null)

    async function updateMarkers() {
      const [{ MarkerClusterer }, { AdvancedMarkerElement }] = await Promise.all([
        import('@googlemaps/markerclusterer'),
        google.maps.importLibrary('marker') as Promise<google.maps.MarkerLibrary>,
      ])

      if (clustererRef.current) {
        clustererRef.current.clearMarkers()
        clustererRef.current.setMap(null)
        clustererRef.current = null
      }
      markersRef.current.forEach((m) => { m.map = null })
      markersRef.current.clear()

      if (locatedPins.length === 0) {
        map.setCenter({ lat: 33.6427, lng: 130.6909 })
        map.setZoom(13)
        return
      }

      const newMarkers: google.maps.marker.AdvancedMarkerElement[] = []
      for (const pin of locatedPins) {
        const pinEl = createPinElement(false)
        const marker = new AdvancedMarkerElement({
          map: null,
          position: { lat: pin.lat!, lng: pin.lng! },
          content: pinEl,
          title: `${pin.name}（${pin.visitCount}回来店）`,
        })
        marker.addListener('click', () => handleMarkerClick(pin, marker))
        markersRef.current.set(pin.restaurantId, marker)
        newMarkers.push(marker)
      }

      const bounds = new google.maps.LatLngBounds()
      for (const p of locatedPins) bounds.extend({ lat: p.lat!, lng: p.lng! })
      if (locatedPins.length === 1) {
        map.setCenter({ lat: locatedPins[0].lat!, lng: locatedPins[0].lng! })
        map.setZoom(15)
      } else {
        map.fitBounds(bounds, 48)
      }

      const clusterer = new MarkerClusterer({
        map,
        markers: newMarkers,
        renderer: {
          render: ({ count, position }) => new AdvancedMarkerElement({
            position,
            content: createClusterElement(count),
            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
          }),
        },
      })
      clustererRef.current = clusterer
    }

    void updateMarkers()
  }, [pins, mapStatus, handleMarkerClick])

  // ── Group mode ────────────────────────────────────────────────────────────

  const handleModeChange = useCallback((newMode: Mode) => {
    setMode(newMode)
    setSelectedPin(null)
    if (selectedPinIdRef.current) {
      const prev = markersRef.current.get(selectedPinIdRef.current)
      if (prev) prev.content = createPinElement(false)
      selectedPinIdRef.current = null
    }

    if (newMode === 'group' && groups.length === 0 && !groupsLoading) {
      setGroupsLoading(true)
      fetch('/api/logbook/map/groups')
        .then((r) => r.ok ? r.json() : Promise.reject(r.status))
        .then((data: { groups: MapGroupInfo[] }) => {
          setGroups(data.groups)
          setGroupsLoading(false)
          if (data.groups.length > 0) {
            setSelectedGroupId(data.groups[0].id)
          }
        })
        .catch(() => setGroupsLoading(false))
    }
  }, [groups.length, groupsLoading])

  useEffect(() => {
    if (!selectedGroupId) return
    let active = true
    fetch(`/api/logbook/map/groups?groupId=${encodeURIComponent(selectedGroupId)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: Omit<GroupStats, 'groupId'>) => {
        if (active) setGroupStats({ ...data, groupId: selectedGroupId })
      })
      .catch(() => { /* leave stale stats until next success */ })
    return () => { active = false }
  }, [selectedGroupId])

  // ── Stats to display ─────────────────────────────────────────────────────

  const displayStats = mode === 'group' && currentGroupStats
    ? {
        col1Label: '参加メンバー',
        col1Value: currentGroupStats.memberCount,
        col1Unit: '人',
        col2Label: '訪問したお店',
        col2Value: currentGroupStats.uniqueRestaurantCount,
        col2Unit: '店舗',
        col3Label: 'これまでの来店',
        col3Value: currentGroupStats.totalVisitCount,
        col3Unit: '回',
      }
    : {
        col1Label: '記録したお店',
        col1Value: personalStats?.uniqueRestaurantCount ?? 0,
        col1Unit: '店舗',
        col2Label: 'これまでの来店',
        col2Value: personalStats?.totalVisitCount ?? 0,
        col2Unit: '回',
        col3Label: '記録した月',
        col3Value: personalStats?.activeMonthCount ?? 0,
        col3Unit: 'ヶ月',
      }

  const showStatsSkeleton = dataLoading || isGroupStatsLoading

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Mode toggle */}
      <div className="mt-4 flex overflow-hidden rounded-full border border-edge bg-surface shadow-[0_1px_4px_rgba(98,55,31,0.07)]">
        {(['personal', 'group'] as const).map((m) => {
          const isActive = mode === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => handleModeChange(m)}
              className={`flex flex-1 items-center justify-center gap-2 py-[10px] text-[13px] font-bold transition-colors ${
                isActive ? 'bg-terra text-white' : 'text-ink-sub'
              }`}
            >
              {m === 'personal' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              )}
              {m === 'personal' ? '自分の地図' : 'グループ'}
            </button>
          )
        })}
      </div>

      {/* Group selector */}
      {mode === 'group' && (
        <div className="mt-3">
          {groupsLoading ? (
            <div className="h-[52px] animate-pulse rounded-2xl border border-edge bg-surface" />
          ) : groups.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-edge bg-surface px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terra/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-ink">参加しているグループはありません</p>
                <Link href="/groups" className="text-[12px] text-terra underline">グループを探す</Link>
              </div>
            </div>
          ) : (
            <div className="relative flex items-center gap-3 rounded-2xl border border-edge bg-surface px-4 py-3 shadow-[0_1px_4px_rgba(98,55,31,0.07)]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terra/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <select
                value={selectedGroupId ?? ''}
                onChange={(e) => {
                  setSelectedGroupId(e.target.value || null)
                  setSelectedPin(null)
                }}
                className="absolute inset-0 h-full w-full cursor-pointer rounded-2xl opacity-0"
                aria-label="グループを選択"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}（{g.memberCount}人）</option>
                ))}
              </select>
              <p className="flex-1 truncate text-[15px] font-bold text-ink">
                {selectedGroup?.name ?? 'グループを選択'}
              </p>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Stats card */}
      <div className="mt-3 flex overflow-hidden rounded-2xl border border-edge bg-surface shadow-[0_2px_8px_rgba(98,55,31,0.06)]">
        {showStatsSkeleton ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-center gap-2 py-5">
              <div className="h-5 w-5 animate-pulse rounded bg-edge" />
              <div className="h-3 w-10 animate-pulse rounded bg-edge" />
              <div className="h-6 w-8 animate-pulse rounded bg-edge" />
            </div>
          ))
        ) : (
          <>
            <StatItem
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {mode === 'group'
                    ? <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>
                    : <><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z"/></>
                  }
                </svg>
              }
              label={displayStats.col1Label}
              value={displayStats.col1Value}
              unit={displayStats.col1Unit}
            />
            <div className="my-3 w-px shrink-0 bg-edge" />
            <StatItem
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              }
              label={displayStats.col2Label}
              value={displayStats.col2Value}
              unit={displayStats.col2Unit}
            />
            <div className="my-3 w-px shrink-0 bg-edge" />
            <StatItem
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              }
              label={displayStats.col3Label}
              value={displayStats.col3Value}
              unit={displayStats.col3Unit}
            />
          </>
        )}
      </div>

      {/* Map area */}
      <div
        className="relative mt-4 overflow-hidden rounded-[18px] border border-edge"
        style={{ height: 380 }}
      >
        {/* No API key */}
        {mapStatus === 'no_key' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-terra/10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="10" r="3"/>
                <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z"/>
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-bold text-ink">Google Maps APIキーが未設定です</p>
              <p className="mt-1 text-[12px] text-ink-sub">
                .env.local に <code className="rounded bg-edge/60 px-1 font-mono text-[11px]">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> を設定してください
              </p>
            </div>
          </div>
        )}

        {/* Map load error */}
        {mapStatus === 'error' && (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-canvas">
            <p className="text-[13px] font-semibold text-ink">地図の読み込みに失敗しました</p>
            <button
              type="button"
              onClick={() => setRetryKey(k => k + 1)}
              className="text-[12px] font-medium text-terra underline"
            >
              再試行
            </button>
          </div>
        )}

        {/* Loading spinner */}
        {(mapStatus === 'idle' || mapStatus === 'loading') && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        )}

        {/* Empty/data error overlay */}
        {mapStatus === 'ready' && !dataLoading && (
          dataError ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas/90">
              <p className="text-[13px] text-ink-sub">{dataError}</p>
            </div>
          ) : pins.filter(p => p.hasLocation).length === 0 ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-canvas/90 p-6 text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C49A80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="10" r="3"/>
                <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z"/>
              </svg>
              {pins.length === 0 ? (
                <>
                  <p className="text-[14px] font-bold text-ink">まだ地図に表示する来店記録がありません</p>
                  <Link href="/record" className="mt-1 inline-flex h-10 items-center rounded-xl bg-terra px-5 text-[13px] font-bold text-white">
                    記録する
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-[14px] font-bold text-ink">位置情報が設定されていません</p>
                  <p className="text-[12px] text-ink-sub">
                    {pins.length}店舗すべてに位置情報が未設定です
                  </p>
                </>
              )}
            </div>
          ) : null
        )}

        {/* Google Maps div */}
        {mapStatus !== 'no_key' && (
          <div ref={mapContainerRef} className="h-full w-full" />
        )}

        {/* Preview card overlay */}
        {selectedPin && (
          <MapPreviewCard
            pin={selectedPin}
            mode={mode}
            selectedGroup={selectedGroup}
            onClose={handleClosePreview}
          />
        )}
      </div>

      {/* No-location notice */}
      {noLocationCount > 0 && !dataLoading && (
        <p className="mt-2 text-center text-[11px] text-ink-sub">
          位置未設定のお店: {noLocationCount}件（統計には含まれます）
        </p>
      )}

      {/* Group sharing notice */}
      {mode === 'group' && (
        <p className="mt-2 rounded-xl border border-edge bg-surface px-3 py-2 text-center text-[11px] text-ink-sub">
          グループメンバーの来店共有は現在開発中です。現在は自分の記録のみ表示しています。
        </p>
      )}

      {/* Info pill */}
      <div className="mt-3 flex items-start gap-2 rounded-full border border-edge bg-surface px-4 py-2.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0 text-ink-sub/60" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <p className="text-[11px] leading-relaxed text-ink-sub">
          地図上のピンをタップすると、記録や訪問回数を確認できます。
        </p>
      </div>
    </>
  )
}
