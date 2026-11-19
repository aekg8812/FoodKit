'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { VisitCardItem } from './VisitCardItem'
import type { VisitCard, LogbookPageResponse } from './types'

// ── Date helpers ─────────────────────────────────────────────────────────────

function parseDateParts(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { year: y, month: m, day: d }
}

function getDayOfWeek(dateStr: string): string {
  const { year, month, day } = parseDateParts(dateStr)
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return ['日', '月', '火', '水', '木', '金', '土'][d.getUTCDay()]
}

function formatDateLabel(dateStr: string): string {
  const { month, day } = parseDateParts(dateStr)
  return `${month}月${day}日（${getDayOfWeek(dateStr)}）`
}

// ── Date grouping ────────────────────────────────────────────────────────────

type DateGroup = { dateKey: string | null; label: string; cards: VisitCard[] }

function computeDateGroups(cards: VisitCard[]): DateGroup[] {
  const map = new Map<string, VisitCard[]>()
  for (const c of cards) {
    const key = c.visitDate ?? '__null__'
    const arr = map.get(key)
    if (arr) arr.push(c)
    else map.set(key, [c])
  }
  return [...map.entries()].map(([key, cards]) => ({
    dateKey: key === '__null__' ? null : key,
    label: key === '__null__' ? '日付未設定' : formatDateLabel(key),
    cards,
  }))
}

// ── Props ────────────────────────────────────────────────────────────────────

type Props = {
  initialItems: VisitCard[]
  initialCursor: string | null   // base64-encoded VisitCursor
  initialHasMore: boolean
  sort: 'newest' | 'oldest'
  ratingFilter: number | null
  restaurantCounts: Record<string, number>
  totalCount: number
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LogbookList({
  initialItems,
  initialCursor,
  initialHasMore,
  sort,
  ratingFilter,
  restaurantCounts,
  totalCount,
}: Props) {
  const [items, setItems] = useState<VisitCard[]>(initialItems)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return
    setLoading(true)
    setFetchError(null)
    try {
      const params = new URLSearchParams({ sort, cursor })
      if (ratingFilter !== null) params.set('rating', String(ratingFilter))
      const res = await fetch(`/api/logbook/visits?${params.toString()}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const json: LogbookPageResponse = await res.json()
      setItems(prev => [...prev, ...json.items])
      setCursor(json.next_cursor)
      setHasMore(json.has_more)
    } catch {
      setFetchError('読み込みに失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }, [cursor, loading, sort, ratingFilter])

  const dateGroups = computeDateGroups(items)

  const clearFilterHref = sort !== 'newest' ? `/logbook?sort=${sort}` : '/logbook'

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-edge bg-surface px-6 py-10 text-center">
        {totalCount > 0 && ratingFilter !== null ? (
          <>
            <p className="text-sm text-ink-sub">条件に合う記録はありません</p>
            <Link
              href={clearFilterHref}
              replace
              className="mt-4 inline-flex h-10 items-center rounded-full border border-edge bg-canvas px-5 text-sm font-medium text-ink"
            >
              フィルターを解除
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-sub">まだ記録がありません</p>
            <Link
              href="/record"
              className="mt-4 inline-flex h-10 items-center rounded-xl bg-terra px-5 text-sm font-medium text-white"
            >
              記録する
            </Link>
          </>
        )}
      </div>
    )
  }

  // ── List ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="mt-3 space-y-5 pb-2">
        {dateGroups.map((group) => (
          <section key={group.dateKey ?? '__null__'} aria-label={group.label}>
            <h2 className="mb-2 text-[17px] font-bold text-ink">{group.label}</h2>
            <div className="space-y-3">
              {group.cards.map((card) => (
                <VisitCardItem
                  key={card.id}
                  card={card}
                  visitCount={restaurantCounts[card.restaurantId] ?? 1}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Error */}
      {fetchError && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-600">
          {fetchError}
        </p>
      )}

      {/* Load more */}
      {hasMore && !fetchError && (
        <div className="mt-4 pb-2 text-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-edge bg-surface px-6 text-sm font-semibold text-ink shadow-[0_1px_4px_rgba(98,55,31,0.07)] hover:bg-canvas disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                読み込み中...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
                もっと見る
              </>
            )}
          </button>
        </div>
      )}

      {/* Retry after error */}
      {fetchError && hasMore && (
        <div className="mt-2 pb-2 text-center">
          <button
            type="button"
            onClick={() => { setFetchError(null); void loadMore() }}
            className="text-sm font-medium text-terra underline"
          >
            再試行
          </button>
        </div>
      )}
    </>
  )
}
