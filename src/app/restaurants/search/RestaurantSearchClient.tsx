'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import ErrorMessage from '@/components/ui/ErrorMessage'
import InputField from '@/components/ui/InputField'
import { createClient } from '@/lib/supabase/client'
import { RESTAURANT_AREAS } from '@/lib/restaurants/areas'
import { RESTAURANT_GENRES } from '@/lib/restaurants/genres'
import { ensureRestaurantAccesses } from '@/lib/restaurants/access'
import {
  searchRestaurants,
  type RestaurantSearchResult,
} from '@/lib/restaurants/search'

function logSearchError(err: unknown) {
  if (err !== null && typeof err === 'object') {
    const { message, code, details, hint } = err as Record<string, unknown>
    console.error('[RestaurantSearchClient] search failed', message, code, details, hint)
  } else {
    console.error('[RestaurantSearchClient] search failed', err)
  }
}

export default function RestaurantSearchClient() {
  const router = useRouter()
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('')
  const [genre, setGenre] = useState('')
  const [results, setResults] = useState<RestaurantSearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selectingId, setSelectingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const newRestaurantParams = new URLSearchParams()
  if (query.trim()) newRestaurantParams.set('name', query.trim())
  if (area) newRestaurantParams.set('area', area)
  if (genre) newRestaurantParams.set('genre', genre)
  const newRestaurantHref = `/restaurants/new?${newRestaurantParams.toString()}`

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedQuery = query.trim()
    if (!normalizedQuery && !area && !genre) return

    setSearching(true)
    setError(null)

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
      setError('店舗の検索に失敗しました。時間をおいて再度お試しください')
    } finally {
      setSearching(false)
    }
  }

  async function handleSelect(restaurantId: string) {
    setSelectingId(restaurantId)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Authentication is required')

      await ensureRestaurantAccesses(supabase, restaurantId, user.id)
      router.push(`/restaurants/${restaurantId}`)
    } catch (err) {
      logSearchError(err)
      setError('店舗を自分の記録に追加できませんでした。時間をおいて再度お試しください')
      setSelectingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 pb-24 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/restaurants"
          className="mb-5 inline-flex min-h-[44px] items-center text-sm font-medium text-ink-sub transition-colors hover:text-ink"
        >
          ← 店舗一覧に戻る
        </Link>

        <h1 className="text-2xl font-bold text-ink">店舗を探す</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-sub">
          店名・エリア・カテゴリから、登録済みの店舗を探せます。
        </p>

        <form onSubmit={handleSearch} className="mt-6 space-y-3">
          <InputField
            id="restaurant-query"
            label="店名"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setError(null)
            }}
            placeholder="例：食堂、ラーメン"
            autoComplete="off"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="restaurant-area" className="block text-sm font-medium text-ink">
                エリア
              </label>
              <select
                id="restaurant-area"
                value={area}
                onChange={(event) => {
                  setArea(event.target.value)
                  setError(null)
                }}
                className="mt-1 min-h-[48px] w-full rounded-xl border border-edge bg-surface px-3 text-base text-ink transition-colors focus:border-terra focus:outline-none"
              >
                <option value="">すべてのエリア</option>
                {RESTAURANT_AREAS.map((areaOption) => (
                  <option key={areaOption} value={areaOption}>
                    {areaOption}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="restaurant-genre" className="block text-sm font-medium text-ink">
                カテゴリ
              </label>
              <select
                id="restaurant-genre"
                value={genre}
                onChange={(event) => {
                  setGenre(event.target.value)
                  setError(null)
                }}
                className="mt-1 min-h-[48px] w-full rounded-xl border border-edge bg-surface px-3 text-base text-ink transition-colors focus:border-terra focus:outline-none"
              >
                <option value="">すべてのカテゴリ</option>
                {RESTAURANT_GENRES.map((genreOption) => (
                  <option key={genreOption} value={genreOption}>
                    {genreOption}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button type="submit" disabled={searching || (!query.trim() && !area && !genre)}>
            {searching ? '検索中…' : '検索する'}
          </Button>
        </form>

        {error && <div className="mt-4"><ErrorMessage message={error} /></div>}

        {hasSearched && (
          <section className="mt-8" aria-live="polite">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">検索結果</h2>
              <p className="text-sm text-ink-sub">{results.length}件</p>
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
                            {selectingId === restaurant.id
                              ? '記録に追加中…'
                              : 'この店舗を選ぶ →'}
                          </p>
                        </Card>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 border-t border-edge pb-4 pt-5 text-center">
                  <p className="text-sm text-ink-sub">探している店舗が見つからない場合</p>
                  <Link
                    href={newRestaurantHref}
                    className="mt-2 inline-flex min-h-[44px] items-center text-sm font-medium text-terra transition-colors hover:text-terra-deep"
                  >
                    新しい店舗として登録する →
                  </Link>
                </div>
              </>
            ) : (
              <Card className="p-6 text-center">
                <p className="font-medium text-ink">店舗が見つかりませんでした</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-sub">
                  店名を変えて検索するか、新しい店舗として登録してください。
                </p>
                <Link
                  href={newRestaurantHref}
                  className="mt-5 inline-flex min-h-[44px] items-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-colors hover:bg-terra-deep"
                >
                  新しく店舗を登録する
                </Link>
              </Card>
            )}
          </section>
        )}
      </div>
      <BottomNav />
    </main>
  )
}
