'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import BottomSheet from '@/components/ui/BottomSheet'
import Button from '@/components/ui/Button'
import { RESTAURANT_AREAS } from '@/lib/restaurants/areas'
import { RESTAURANT_GENRES } from '@/lib/restaurants/genres'

type TodayFilterSheetProps = {
  area: string
  genre: string
  budget: string
}

const BUDGET_OPTIONS = [
  { value: 'low', label: '〜1,000円' },
  { value: 'mid', label: '1,000〜3,000円' },
  { value: 'high', label: '3,000円〜' },
] as const

export default function TodayFilterSheet({
  area: initialArea,
  genre: initialGenre,
  budget: initialBudget,
}: TodayFilterSheetProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [area, setArea] = useState(initialArea)
  const [genre, setGenre] = useState(initialGenre)
  const [budget, setBudget] = useState(initialBudget)
  const hasFilter = Boolean(initialArea || initialGenre || initialBudget)

  function applyFilters() {
    const params = new URLSearchParams()
    if (area) params.set('area', area)
    if (genre) params.set('genre', genre)
    if (budget) params.set('budget', budget)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
    setOpen(false)
  }

  function clearFilters() {
    setArea('')
    setGenre('')
    setBudget('')
    router.push(pathname)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="今日の条件を設定"
        aria-expanded={open}
        aria-controls="today-filter-sheet"
        className="flex min-h-[44px] w-full items-center gap-3 rounded-full border border-edge bg-surface px-5 text-left shadow-sm transition-all duration-150 hover:shadow-md motion-safe:active:scale-[0.99]"
      >
        <span className="text-base" aria-hidden="true">
          🔍
        </span>
        <span className="text-sm text-ink-sub">
          {hasFilter ? '条件優先中' : '店舗を探す・追加する'}
        </span>
      </button>

      <BottomSheet
        id="today-filter-sheet"
        open={open}
        title="今日の条件"
        onClose={() => setOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="today-filter-area" className="block text-sm font-medium text-ink">
              エリア
            </label>
            <select
              id="today-filter-area"
              value={area}
              onChange={(event) => setArea(event.target.value)}
              className="mt-1 min-h-[48px] w-full rounded-xl border border-edge bg-surface px-3 text-base text-ink focus:border-terra focus:outline-none"
            >
              <option value="">すべてのエリア</option>
              {RESTAURANT_AREAS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="today-filter-genre" className="block text-sm font-medium text-ink">
              ジャンル
            </label>
            <select
              id="today-filter-genre"
              value={genre}
              onChange={(event) => setGenre(event.target.value)}
              className="mt-1 min-h-[48px] w-full rounded-xl border border-edge bg-surface px-3 text-base text-ink focus:border-terra focus:outline-none"
            >
              <option value="">すべてのジャンル</option>
              {RESTAURANT_GENRES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="today-filter-budget" className="block text-sm font-medium text-ink">
              予算
            </label>
            <select
              id="today-filter-budget"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              className="mt-1 min-h-[48px] w-full rounded-xl border border-edge bg-surface px-3 text-base text-ink focus:border-terra focus:outline-none"
            >
              <option value="">指定なし</option>
              {BUDGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 pt-2">
            <Button type="button" onClick={applyFilters}>
              適用する
            </Button>
            <Button type="button" variant="secondary" onClick={clearFilters}>
              条件をクリア
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
