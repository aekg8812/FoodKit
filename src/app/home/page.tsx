import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import ValueTypeBadge from '@/components/ValueTypeBadge'
import RestaurantCard from '@/components/RestaurantCard'
import CategoryChips from './CategoryChips'
import {
  buildProfileMap,
  buildEligibleUserIds,
  sortRestaurants,
  type RestaurantRow,
  type ReviewRow,
  type ProfileRow,
} from '@/lib/restaurants/aggregate'
import { VALUE_TYPE_LABEL, type MainValueType } from '@/lib/onboarding/classifyValueType'

const TOP_N = 5

type HomeReviewRow = ReviewRow & {
  image_path: string | null
  visit_date: string | null
  created_at: string
}

export default async function HomePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [restaurantsResult, reviewsResult, profilesResult, userResult] = await Promise.all([
    supabase.from('restaurants').select('id, name, area, genre, created_at'),
    supabase
      .from('reviews')
      .select('restaurant_id, rating, user_id, image_path, visit_date, created_at'),
    supabase.from('user_value_profiles').select('user_id, main_value_type'),
    supabase.from('users').select('name').eq('id', user.id).single(),
  ])

  if (restaurantsResult.error) {
    throw new Error(`HomePage: failed to load restaurants: ${restaurantsResult.error.message}`)
  }
  if (reviewsResult.error) {
    throw new Error(`HomePage: failed to load reviews: ${reviewsResult.error.message}`)
  }
  if (profilesResult.error) {
    throw new Error(`HomePage: failed to load profiles: ${profilesResult.error.message}`)
  }

  const restaurants = (restaurantsResult.data ?? []) as RestaurantRow[]
  const reviews = (reviewsResult.data ?? []) as HomeReviewRow[]
  const profiles = (profilesResult.data ?? []) as ProfileRow[]
  const userName = (userResult.data?.name as string | null | undefined) ?? null

  const profileMap = buildProfileMap(profiles)
  const myValueType = (profileMap.get(user.id) ?? null) as MainValueType | null
  const eligibleUserIds = buildEligibleUserIds(profileMap, myValueType)
  const topRestaurants = sortRestaurants(restaurants, reviews, eligibleUserIds).slice(0, TOP_N)
  const countLabel = myValueType ? VALUE_TYPE_LABEL[myValueType] : '全員'

  // おすすめ代表画像: 並び順は変えず、各店舗の最新レビュー写真だけをカードへ渡す
  const topRestaurantIds = new Set(topRestaurants.map(({ restaurant }) => restaurant.id))
  const latestImagePathByRestaurant = new Map<string, string>()
  const imageReviews = reviews
    .filter(
      (review) =>
        topRestaurantIds.has(review.restaurant_id) && Boolean(review.image_path),
    )
    .sort((a, b) => {
      const aDate = a.visit_date ?? a.created_at
      const bDate = b.visit_date ?? b.created_at
      return new Date(bDate).getTime() - new Date(aDate).getTime()
    })

  for (const review of imageReviews) {
    if (!latestImagePathByRestaurant.has(review.restaurant_id) && review.image_path) {
      latestImagePathByRestaurant.set(review.restaurant_id, review.image_path)
    }
  }

  const signedImageEntries = await Promise.all(
    [...latestImagePathByRestaurant.entries()].map(async ([restaurantId, imagePath]) => {
      const { data: signedImage } = await supabase.storage
        .from('review-images')
        .createSignedUrl(imagePath, 60 * 60)
      return [restaurantId, signedImage?.signedUrl ?? null] as const
    }),
  )
  const imageUrlByRestaurant = new Map(signedImageEntries)

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* 挨拶 */}
      <div className="px-6 pb-5 pt-10">
        <p className="mb-1 text-2xl font-bold text-ink">
          {userName ? `こんにちは、${userName}さん` : 'こんにちは'}
          <span className="ml-1.5" aria-hidden="true">👋</span>
        </p>
        <p className="text-base text-ink-sub">今日は何が食べたい?</p>
      </div>

      {/* 検索バー */}
      <div className="mb-6 px-6">
        <Link href="/restaurants" className="block">
          <div
            role="button"
            className="flex min-h-[44px] items-center gap-3 rounded-full border border-edge bg-surface px-5 shadow-sm transition-all duration-150 hover:shadow-md motion-safe:active:scale-[0.99]"
          >
            <span className="text-base" aria-hidden="true">🔍</span>
            <span className="text-sm text-ink-sub">店舗を探す（近日公開）</span>
          </div>
        </Link>
      </div>

      {/* クイックカテゴリ */}
      <section className="mb-8">
        <div className="mb-3 px-6">
          <h2 className="text-base font-semibold text-ink">カテゴリ</h2>
        </div>
        <CategoryChips />
      </section>

      {/* おすすめ */}
      <section className="px-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">おすすめ</h2>
          <Link
            href="/restaurants"
            className="text-sm text-terra transition-colors duration-150 hover:text-terra-deep"
          >
            全て見る →
          </Link>
        </div>

        {myValueType && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-sub">あなたのタイプ：</span>
            <ValueTypeBadge type={myValueType} />
          </div>
        )}

        {topRestaurants.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface p-8 text-center shadow-sm">
            <p className="mb-2 text-3xl" aria-hidden="true">🍽️</p>
            <p className="mb-5 text-sm text-ink-sub">まだ店舗がありません。登録してみましょう。</p>
            <Link
              href="/restaurants/new"
              className="inline-flex min-h-[44px] items-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-all duration-150 hover:bg-terra-deep motion-safe:active:scale-[0.98]"
            >
              店舗を登録
            </Link>
          </div>
        ) : (
          /* -mx-6 で親 px-6 をキャンセルし画面端まで広げる */
          <div className="-mx-6 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-4 pl-6 pr-4 pb-3">
              {topRestaurants.map(({ restaurant, dist }) => (
                <div key={restaurant.id} className="w-[280px] shrink-0 snap-start">
                  <RestaurantCard
                    restaurant={restaurant}
                    dist={dist}
                    countLabel={countLabel}
                    imageUrl={imageUrlByRestaurant.get(restaurant.id) ?? undefined}
                    variant="compact"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <BottomNav />
    </main>
  )
}
