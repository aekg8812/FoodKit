'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type GooglePlace = {
  id: string
  displayName: string
  formattedAddress: string | null
}

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; places: GooglePlace[] }
  | { kind: 'error' }

export default function RecordSearchClient() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [fetchState, setFetchState] = useState<FetchState>({ kind: 'idle' })
  const [navigatingId, setNavigatingId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const trimmed = query.trim()

    if (timerRef.current) clearTimeout(timerRef.current)
    abortRef.current?.abort()

    if (trimmed.length < 2) return

    timerRef.current = setTimeout(() => {
      const ac = new AbortController()
      abortRef.current = ac

      setFetchState({ kind: 'loading' })

      fetch('/api/places/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
        signal: ac.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error('fetch failed')
          return res.json() as Promise<{ places?: GooglePlace[] }>
        })
        .then((data) => {
          setFetchState({ kind: 'results', places: data.places ?? [] })
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setFetchState({ kind: 'error' })
        })
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [query])

  // Derive display state: when query is too short, treat as idle regardless of fetchState
  const displayState: FetchState =
    query.trim().length < 2 ? { kind: 'idle' } : fetchState

  function handleSelect(place: GooglePlace) {
    if (navigatingId) return
    setNavigatingId(place.id)
    router.push(`/record/place/${encodeURIComponent(place.id)}`)
  }

  return (
    <div className="space-y-2">
      {/* Search input */}
      <label className="flex items-center gap-2 rounded-full border border-edge bg-surface px-4 py-3">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-ink-sub"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="店名・ジャンル・エリアで検索"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-sub"
          autoComplete="off"
          aria-label="店舗を検索"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setFetchState({ kind: 'idle' }) }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-sub/20 text-ink-sub"
            aria-label="クリア"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M1 1l8 8M9 1 1 9" />
            </svg>
          </button>
        )}
      </label>

      {/* Candidate list */}
      {displayState.kind === 'loading' && (
        <div className="space-y-2" aria-live="polite" aria-label="検索中">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[66px] animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      )}

      {displayState.kind === 'error' && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
          検索に失敗しました。時間をおいて再度お試しください
        </p>
      )}

      {displayState.kind === 'results' && displayState.places.length === 0 && (
        <p className="px-1 text-sm text-ink-sub" aria-live="polite">
          「{query.trim()}」に一致するお店が見つかりませんでした
        </p>
      )}

      {displayState.kind === 'results' && displayState.places.length > 0 && (
        <ul
          id="record-search-results"
          className="space-y-2"
          aria-label="候補店舗"
          aria-live="polite"
        >
          {displayState.places.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => handleSelect(place)}
                disabled={navigatingId !== null}
                className="flex w-full items-center gap-3 rounded-2xl border border-edge bg-surface px-4 py-3 text-left hover:bg-canvas disabled:opacity-60 active:bg-canvas"
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
                  <p className="font-bold text-ink" translate="no">
                    {navigatingId === place.id ? '確認中...' : place.displayName}
                  </p>
                  {place.formattedAddress && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-ink-sub" translate="no">
                      {place.formattedAddress}
                    </p>
                  )}
                </div>
                <svg
                  width="8"
                  height="14"
                  viewBox="0 0 8 14"
                  fill="none"
                  className="shrink-0 text-ink-sub"
                  aria-hidden="true"
                >
                  <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
