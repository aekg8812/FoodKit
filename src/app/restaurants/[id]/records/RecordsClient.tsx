'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import ReviewCard, { type ReviewCardData } from '@/components/ReviewCard'
import ReviewTabsNav, { type ReviewTab } from '@/components/ReviewTabsNav'
import { createClient } from '@/lib/supabase/client'

type Sort = 'newest' | 'oldest'

type RpcRow = {
  review_id: string
  restaurant_id: string
  user_id: string
  username: string | null
  name: string | null
  avatar_path: string | null
  rating: number
  comment: string | null
  visit_date: string | null
  image_path: string | null
  created_at: string
}

type Props = {
  restaurantId: string
  userId: string
  initialTab: ReviewTab
  initialSort: Sort
}

export default function RecordsClient({ restaurantId, userId, initialTab, initialSort }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tab = (() => {
    const v = searchParams.get('reviewTab')
    if (v === 'similar' || v === 'following') return v as ReviewTab
    return 'all' as ReviewTab
  })()
  const sort = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest'

  const [restaurantName, setRestaurantName] = useState<string | null>(null)
  const [reviews, setReviews] = useState<ReviewCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewerCardCount, setViewerCardCount] = useState<number>(0)

  // Suppress unused warning — initial values are used for SSR hint only
  void initialTab
  void initialSort

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(key, value)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      setLoading(true)
      setError(null)

      const [restaurantResult, rpcResult, cardCountResult] = await Promise.all([
        supabase
          .from('restaurants')
          .select('id, name')
          .eq('id', restaurantId)
          .maybeSingle(),
        supabase.rpc('get_restaurant_reviews_v2', {
          p_restaurant_id: restaurantId,
          p_scope: tab,
          p_sort: sort,
          p_limit: 50,
          p_offset: 0,
        }),
        supabase
          .from('user_preference_cards')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
      ])

      if (restaurantResult.data) {
        setRestaurantName((restaurantResult.data as { name: string }).name)
      }

      setViewerCardCount(cardCountResult.count ?? 0)

      if (rpcResult.error) {
        setError(rpcResult.error.message)
        setLoading(false)
        return
      }

      const rows = (rpcResult.data ?? []) as RpcRow[]

      // Signed URLs for review images
      const imagePaths = [
        ...new Set(rows.map((r) => r.image_path).filter((p): p is string => Boolean(p))),
      ]
      const signedMap = new Map<string, string>()
      if (imagePaths.length) {
        const { data: signed } = await supabase.storage
          .from('review-images')
          .createSignedUrls(imagePaths, 60 * 60)
        for (const item of signed ?? []) {
          if (item.path && !item.error && item.signedUrl) signedMap.set(item.path, item.signedUrl)
        }
      }

      // Avatar URLs (public bucket)
      const avatarPaths = [
        ...new Set(rows.map((r) => r.avatar_path).filter((p): p is string => Boolean(p))),
      ]
      const avatarMap = new Map<string, string>()
      for (const path of avatarPaths) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarMap.set(path, data.publicUrl)
      }

      const cards: ReviewCardData[] = rows.map((row) => ({
        review_id: row.review_id,
        restaurant_id: row.restaurant_id,
        user_id: row.user_id,
        username: row.username,
        name: row.name,
        avatar_path: row.avatar_path,
        avatar_url: row.avatar_path ? (avatarMap.get(row.avatar_path) ?? null) : null,
        rating: row.rating,
        comment: row.comment,
        visit_date: row.visit_date,
        image_path: row.image_path,
        image_url: row.image_path ? (signedMap.get(row.image_path) ?? null) : null,
        created_at: row.created_at,
      }))

      setReviews(cards)
      setLoading(false)
    }

    load()
  }, [restaurantId, userId, tab, sort])

  const viewerNeedsPreference = tab === 'similar' && viewerCardCount < 5

  const emptyMessages: Record<ReviewTab, string> = {
    all: 'まだこのお店の記録はありません',
    similar: '好みが近い人の記録はまだありません',
    following: 'フォロー中の人の記録はまだありません',
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-edge bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Link
            href={`/restaurants/${restaurantId}?reviewTab=${tab}`}
            className="shrink-0 text-sm text-ink-sub transition-colors hover:text-ink"
          >
            ←
          </Link>
          <div className="min-w-0">
            <p className="truncate text-xs text-ink-sub">{restaurantName ?? '…'}</p>
            <h1 className="text-sm font-semibold text-ink">この店の記録</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-4">
        <div className="rounded-xl border border-edge bg-surface overflow-hidden">
          {/* Tabs */}
          <ReviewTabsNav activeTab={tab} />

          {/* Sort */}
          <div className="flex items-center gap-3 border-b border-edge px-4 py-2">
            <span className="text-xs text-ink-sub">並び順：</span>
            <button
              onClick={() => setParam('sort', 'newest')}
              className={`text-xs font-medium transition-colors ${sort === 'newest' ? 'text-terra' : 'text-ink-sub hover:text-ink'}`}
            >
              新しい順
            </button>
            <span className="text-xs text-ink-sub">|</span>
            <button
              onClick={() => setParam('sort', 'oldest')}
              className={`text-xs font-medium transition-colors ${sort === 'oldest' ? 'text-terra' : 'text-ink-sub hover:text-ink'}`}
            >
              古い順
            </button>
          </div>

          {/* Content */}
          <div className="space-y-3 p-4">
            {loading ? (
              <p className="py-4 text-center text-sm text-ink-sub">読み込み中…</p>
            ) : error ? (
              <p className="py-4 text-center text-sm text-red-500">{error}</p>
            ) : viewerNeedsPreference ? (
              <div className="rounded-xl bg-canvas px-4 py-6 text-center">
                <p className="text-sm text-ink-sub">
                  好みを設定すると、あなたと食の好みが近い人の記録を表示できます。
                </p>
                <Link
                  href="/mypage/food-preferences/edit"
                  className="mt-3 inline-block rounded-full bg-terra px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-terra-deep"
                >
                  好みを設定する
                </Link>
              </div>
            ) : reviews.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-sub">{emptyMessages[tab]}</p>
            ) : (
              reviews.map((review) => (
                <ReviewCard
                  key={review.review_id}
                  review={review}
                  currentUserId={userId}
                  detailHref={`/records/${review.review_id}`}
                />
              ))
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
