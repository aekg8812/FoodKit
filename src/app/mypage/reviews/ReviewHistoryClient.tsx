'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import ErrorMessage from '@/components/ui/ErrorMessage'
import RatingBadge, { RATING_LABELS } from '@/components/RatingBadge'
import { createClient } from '@/lib/supabase/client'

export type ReviewHistoryRow = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  created_at: string
  restaurant_id: string
  restaurants: { id: string; name: string } | null
}

interface Props {
  reviews: ReviewHistoryRow[]
}

type RatingFilter = 'all' | 1 | 2 | 3 | 4
type SortOrder = 'newest' | 'oldest'

const RATING_FILTERS: Array<{ value: RatingFilter; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 4, label: '4' },
  { value: 3, label: '3' },
  { value: 2, label: '2' },
  { value: 1, label: '1' },
]

export default function ReviewHistoryClient({ reviews }: Props) {
  const supabase = createClient()
  const [reviewRows, setReviewRows] = useState(reviews)
  const [query, setQuery] = useState('')
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [reviewToDelete, setReviewToDelete] = useState<ReviewHistoryRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // レビュー履歴UI: 店名・コメント・評価で絞り込み、訪問日を優先して並べる
  const visibleReviews = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ja')

    return reviewRows
      .filter((review) => {
        if (ratingFilter !== 'all' && review.rating !== ratingFilter) return false
        if (!normalizedQuery) return true

        return [review.restaurants?.name, review.comment]
          .filter((value): value is string => Boolean(value))
          .some((value) => value.toLocaleLowerCase('ja').includes(normalizedQuery))
      })
      .sort((a, b) => {
        const aDate = a.visit_date ?? a.created_at
        const bDate = b.visit_date ?? b.created_at
        const difference = new Date(bDate).getTime() - new Date(aDate).getTime()
        return sortOrder === 'newest' ? difference : -difference
      })
  }, [query, ratingFilter, reviewRows, sortOrder])

  const hasActiveFilters = Boolean(query) || ratingFilter !== 'all'

  function clearFilters() {
    setQuery('')
    setRatingFilter('all')
  }

  function openDeleteDialog(review: ReviewHistoryRow) {
    setReviewToDelete(review)
    setDeleteError(null)
  }

  function closeDeleteDialog() {
    if (deleting) return
    setReviewToDelete(null)
    setDeleteError(null)
  }

  // レビュー削除: RLSで本人所有を確認し、成功後に一覧から即時反映する
  async function handleDelete() {
    if (!reviewToDelete) return

    setDeleting(true)
    setDeleteError(null)

    const { data, error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewToDelete.id)
      .select('id')

    if (error || !data || data.length !== 1) {
      setDeleteError('レビューを削除できませんでした。時間をおいて再度お試しください')
      setDeleting(false)
      return
    }

    setReviewRows((current) => current.filter((review) => review.id !== reviewToDelete.id))
    setReviewToDelete(null)
    setDeleting(false)
  }

  return (
    <>
      {/* レビュー履歴UI: 検索・評価・並び順をひとつの操作領域にまとめる */}
      <div className="mb-5 space-y-3">
        <div className="relative">
          <label htmlFor="review_history_search" className="sr-only">
            レビュー履歴を検索
          </label>
          <input
            id="review_history_search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="店名・コメントで絞り込み"
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

        <div>
          <p className="mb-2 text-xs font-medium text-ink-sub">評価</p>
          <div className="grid grid-cols-5 gap-1 rounded-lg border border-edge bg-surface p-1">
            {RATING_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={ratingFilter === option.value}
                onClick={() => setRatingFilter(option.value)}
                className={`min-h-[40px] rounded-md text-sm font-medium transition-colors ${
                  ratingFilter === option.value
                    ? 'bg-terra text-white'
                    : 'text-ink-sub hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
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
        <p>{hasActiveFilters ? '絞り込み結果' : '投稿したレビュー'}</p>
        <p className="tabular-nums">{visibleReviews.length}件</p>
      </div>

      {visibleReviews.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-ink-sub">
            {hasActiveFilters ? '条件に一致するレビューがありません' : 'まだレビューを投稿していません'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 min-h-[44px] text-sm font-medium text-terra hover:text-terra-deep"
            >
              絞り込みを解除
            </button>
          )}
        </Card>
      ) : (
        <ul className="space-y-3">
          {visibleReviews.map((review) => (
            <li key={review.id}>
              <Card className="overflow-hidden">
                <Link
                  href={`/restaurants/${review.restaurant_id}`}
                  className="block p-5 transition-colors hover:bg-canvas"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {review.restaurants?.name ?? '（店舗情報なし）'}
                      </p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                        <RatingBadge rating={review.rating} />
                        <span className="text-ink-sub">{RATING_LABELS[review.rating]}</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-sm text-ink-sub" aria-hidden="true">→</span>
                  </div>
                  {review.comment && (
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-sub">
                      {review.comment}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-ink-sub">
                    {review.visit_date ? `訪問日 ${review.visit_date}` : `投稿日 ${review.created_at.slice(0, 10)}`}
                  </p>
                </Link>
                {/* レビュー削除: 店舗詳細へのリンクと削除操作を分離する */}
                <div className="border-t border-edge px-5 py-2">
                  <button
                    type="button"
                    onClick={() => openDeleteDialog(review)}
                    className="min-h-[40px] text-sm font-medium text-red-600 transition-colors hover:text-red-700"
                  >
                    このレビューを削除
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {reviewToDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          {/* レビュー削除: 取り消せない操作の前に明示的な確認を求める */}
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-review-title"
            className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-xl"
          >
            <h2 id="delete-review-title" className="text-lg font-semibold text-ink">
              このレビューを削除しますか？
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-sub">
              {reviewToDelete.restaurants?.name ?? 'この店舗'}へのレビューを削除します。削除したレビューは元に戻せません。
            </p>

            {deleteError && (
              <div className="mt-4">
                <ErrorMessage message={deleteError} />
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={deleting}
                className="min-h-[44px] rounded-full border border-edge px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="min-h-[44px] rounded-full bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
