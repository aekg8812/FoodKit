'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import Card from '@/components/ui/Card'

export type RegisteredRestaurantRow = {
  id: string
  name: string
  area: string | null
  genre: string | null
  created_at: string
}

interface Props {
  restaurants: RegisteredRestaurantRow[]
}

type SortOrder = 'newest' | 'oldest'

export default function RegisteredRestaurantsClient({ restaurants }: Props) {
  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')

  // 登録店舗一覧UI: 取得済みデータを店名・ジャンル・エリアで絞り込み、登録日順に並べる
  const visibleRestaurants = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ja')

    return restaurants
      .filter((restaurant) => {
        if (!normalizedQuery) return true
        return [restaurant.name, restaurant.genre, restaurant.area]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLocaleLowerCase('ja').includes(normalizedQuery))
      })
      .sort((a, b) => {
        const difference =
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        return sortOrder === 'newest' ? difference : -difference
      })
  }, [query, restaurants, sortOrder])

  return (
    <>
      {/* 登録店舗一覧UI: 検索と並び順を同じ操作領域にまとめる */}
      <div className="mb-5 space-y-3">
        <div className="relative">
          <label htmlFor="registered_restaurant_search" className="sr-only">
            登録した店舗を検索
          </label>
          <input
            id="registered_restaurant_search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="店名・ジャンル・エリアで絞り込み"
            className="min-h-[44px] w-full rounded-lg border border-edge bg-surface px-4 pr-12 text-sm text-ink outline-none transition-colors placeholder:text-ink-sub focus:border-terra"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="検索条件をクリア"
              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center text-lg text-ink-sub hover:text-ink"
            >
              ×
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 rounded-lg border border-edge bg-surface p-1">
          {([
            { value: 'newest', label: '新しい順' },
            { value: 'oldest', label: '古い順' },
          ] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={sortOrder === option.value}
              onClick={() => setSortOrder(option.value)}
              className={`min-h-[40px] rounded-md text-sm font-medium transition-colors ${
                sortOrder === option.value
                  ? 'bg-terra text-white'
                  : 'text-ink-sub hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 text-sm text-ink-sub">
        <p>{query ? '絞り込み結果' : '登録した店舗'}</p>
        <p className="tabular-nums">{visibleRestaurants.length}件</p>
      </div>

      {visibleRestaurants.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-ink-sub">
            {query ? '条件に一致する店舗がありません' : 'まだ店舗を登録していません'}
          </p>
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-4 min-h-[44px] text-sm font-medium text-terra hover:text-terra-deep"
            >
              絞り込みを解除
            </button>
          )}
        </Card>
      ) : (
        <ul className="space-y-3">
          {visibleRestaurants.map((restaurant) => (
            <li key={restaurant.id}>
              <Link href={`/restaurants/${restaurant.id}`} className="block">
                <Card interactive className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{restaurant.name}</p>
                      {(restaurant.genre || restaurant.area) && (
                        <p className="mt-1 text-sm text-ink-sub">
                          {[restaurant.genre, restaurant.area].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm text-ink-sub" aria-hidden="true">→</span>
                  </div>
                  <p className="mt-3 text-xs text-ink-sub">
                    登録日 {restaurant.created_at.slice(0, 10)}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
