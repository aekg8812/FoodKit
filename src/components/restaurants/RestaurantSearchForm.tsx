'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import ErrorMessage from '@/components/ui/ErrorMessage'
import InputField from '@/components/ui/InputField'
import { createClient } from '@/lib/supabase/client'
import { RESTAURANT_AREAS } from '@/lib/restaurants/areas'
import { RESTAURANT_GENRES } from '@/lib/restaurants/genres'
import { searchRestaurants, type RestaurantSearchResult } from '@/lib/restaurants/search'

function logSearchError(err: unknown) {
  if (err !== null && typeof err === 'object') {
    const { message, code, details, hint } = err as Record<string, unknown>
    console.error('[RestaurantSearchForm] search failed', message, code, details, hint)
  } else {
    console.error('[RestaurantSearchForm] search failed', err)
  }
}

// SVG for the 0-results empty state icon
function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

export type RestaurantSearchFormProps = {
  /** Called when the user selects a restaurant. The form shows a loading state
   *  until the returned promise settles; errors are re-thrown so the caller can
   *  display them while the form resets its own loading state. */
  onSelect: (restaurantId: string) => Promise<void>
  /** Label shown on each result card's action. Defaults to "この店舗を選ぶ →" */
  selectLabel?: string
  /** Base path for the "register new restaurant" link (e.g. "/restaurants/new?from=record").
   *  When provided, the current query/area/genre are appended as URL params.
   *  The link appears both below the results list and in the 0-results empty state. */
  newRestaurantBasePath?: string
  /** Initial values — intended for future URL searchParams support. */
  defaultQuery?: string
  defaultArea?: string
  defaultGenre?: string
}

export default function RestaurantSearchForm({
  onSelect,
  selectLabel = 'この店舗を選ぶ →',
  newRestaurantBasePath,
  defaultQuery = '',
  defaultArea = '',
  defaultGenre = '',
}: RestaurantSearchFormProps) {
  const supabase = createClient()

  const [query, setQuery] = useState(defaultQuery)
  const [area, setArea] = useState(defaultArea)
  const [genre, setGenre] = useState(defaultGenre)
  const [results, setResults] = useState<RestaurantSearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Build the "new restaurant" href from the base path + current search state
  const newRestaurantHref = useMemo(() => {
    if (!newRestaurantBasePath) return null
    const [basePath, baseSearch] = newRestaurantBasePath.split('?')
    const params = new URLSearchParams(baseSearch ?? '')
    if (query.trim()) params.set('name', query.trim())
    if (area) params.set('area', area)
    if (genre) params.set('genre', genre)
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }, [newRestaurantBasePath, query, area, genre])

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedQuery = query.trim()
    if (!normalizedQuery && !area && !genre) return

    setSearching(true)
    setSearchError(null)

    try {
      const restaurants = await searchRestaurants(supabase, {
        query: normalizedQuery,
        area,
        genre,
      })
      setResults(restaurants)
      setHasSearched(true)
    } catch (err) {
      logSearchError(err)
      setResults([])
      setHasSearched(false)
      setSearchError('店舗の検索に失敗しました。時間をおいて再度お試しください')
    } finally {
      setSearching(false)
    }
  }

  async function handleSelect(restaurantId: string) {
    if (selectingId !== null) return // prevent double-tap
    setSelectingId(restaurantId)
    try {
      await onSelect(restaurantId)
      // On success the caller navigates away; no local state reset needed.
    } catch {
      // Caller already handles error display; reset to re-enable the buttons.
      setSelectingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search form */}
      <form onSubmit={handleSearch} className="space-y-3">
        <InputField
          id="restaurant-search-query"
          label="店名"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setSearchError(null)
          }}
          placeholder="例：食堂、ラーメン"
          autoComplete="off"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="restaurant-search-area"
              className="block text-sm font-medium text-ink"
            >
              エリア
            </label>
            <select
              id="restaurant-search-area"
              value={area}
              onChange={(event) => {
                setArea(event.target.value)
                setSearchError(null)
              }}
              className="mt-1 min-h-[48px] w-full rounded-xl border border-edge bg-surface px-3 text-base text-ink transition-colors focus:border-terra focus:outline-none"
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
            <label
              htmlFor="restaurant-search-genre"
              className="block text-sm font-medium text-ink"
            >
              ジャンル
            </label>
            <select
              id="restaurant-search-genre"
              value={genre}
              onChange={(event) => {
                setGenre(event.target.value)
                setSearchError(null)
              }}
              className="mt-1 min-h-[48px] w-full rounded-xl border border-edge bg-surface px-3 text-base text-ink transition-colors focus:border-terra focus:outline-none"
            >
              <option value="">すべてのジャンル</option>
              {RESTAURANT_GENRES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          type="submit"
          disabled={searching || (!query.trim() && !area && !genre)}
        >
          {searching ? '検索中…' : '検索する'}
        </Button>
      </form>

      {searchError && <ErrorMessage message={searchError} />}

      {/* Results */}
      {hasSearched && (
        <section aria-live="polite">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">検索結果</h2>
            <p className="text-sm tabular-nums text-ink-sub">{results.length}件</p>
          </div>

          {results.length > 0 ? (
            <>
              <ul className="space-y-3">
                {results.map((restaurant) => (
                  <li key={restaurant.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(restaurant.id)}
                      disabled={selectingId !== null}
                      className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Card interactive className="p-4">
                        <p className="font-medium text-ink">{restaurant.name}</p>
                        {(restaurant.area || restaurant.genre) && (
                          <p className="mt-1 text-sm text-ink-sub">
                            {[restaurant.area, restaurant.genre].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {restaurant.address && (
                          <p className="mt-1 text-xs leading-relaxed text-ink-sub">
                            {restaurant.address}
                          </p>
                        )}
                        <p className="mt-3 text-sm font-medium text-terra">
                          {selectingId === restaurant.id ? '追加中…' : selectLabel}
                        </p>
                      </Card>
                    </button>
                  </li>
                ))}
              </ul>

              {newRestaurantHref && (
                <div className="mt-6 border-t border-edge pb-4 pt-5 text-center">
                  <p className="text-sm text-ink-sub">探している店舗が見つからない場合</p>
                  <Link
                    href={newRestaurantHref}
                    className="mt-2 inline-flex min-h-[44px] items-center text-sm font-medium text-terra transition-colors hover:text-terra-deep"
                  >
                    新しい飲食店を登録する →
                  </Link>
                </div>
              )}
            </>
          ) : newRestaurantHref ? (
            <EmptyState
              icon={<SearchIcon />}
              title="店舗が見つかりませんでした"
              description="店名を変えて検索するか、新しい店舗として登録してください。"
              action={
                <Link
                  href={newRestaurantHref}
                  className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-colors hover:bg-terra-deep"
                >
                  新しい飲食店を登録する
                </Link>
              }
            />
          ) : (
            <Card className="p-6 text-center">
              <p className="font-medium text-ink">店舗が見つかりませんでした</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-sub">
                店名を変えて検索してみてください。
              </p>
            </Card>
          )}
        </section>
      )}
    </div>
  )
}
