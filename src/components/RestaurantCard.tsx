import Link from 'next/link'
import DistributionDisplay from '@/components/DistributionDisplay'
import type { RestaurantRow, Distribution } from '@/lib/restaurants/aggregate'

type GenreInfo = { emoji: string; gradientClass: string }

function getGenreInfo(genre: string | null): GenreInfo {
  if (!genre) return { emoji: '🍽️', gradientClass: 'from-orange-50 to-amber-100' }
  const g = genre
  if (g.includes('寿司') || g.includes('すし') || g.includes('海鮮') || g.includes('魚'))
    return { emoji: '🍣', gradientClass: 'from-sky-50 to-blue-100' }
  if (g.includes('ラーメン') || g.includes('らーめん') || g.includes('麺'))
    return { emoji: '🍜', gradientClass: 'from-amber-50 to-yellow-100' }
  if (g.includes('焼肉') || g.includes('やきにく') || g.includes('肉') || g.includes('ステーキ'))
    return { emoji: '🥩', gradientClass: 'from-red-50 to-rose-100' }
  if (
    g.includes('カフェ') ||
    g.includes('珈琲') ||
    g.includes('コーヒー') ||
    g.includes('cafe') ||
    g.includes('Cafe')
  )
    return { emoji: '☕', gradientClass: 'from-stone-50 to-amber-50' }
  if (g.includes('居酒屋') || g.includes('和食') || g.includes('日本料理'))
    return { emoji: '🍶', gradientClass: 'from-purple-50 to-indigo-100' }
  if (g.includes('イタリアン') || g.includes('パスタ') || g.includes('ピザ'))
    return { emoji: '🍝', gradientClass: 'from-green-50 to-emerald-100' }
  if (g.includes('カレー'))
    return { emoji: '🍛', gradientClass: 'from-yellow-50 to-amber-100' }
  if (g.includes('焼き鳥') || g.includes('やきとり') || g.includes('鶏'))
    return { emoji: '🍗', gradientClass: 'from-orange-50 to-amber-100' }
  if (g.includes('フレンチ') || g.includes('フランス'))
    return { emoji: '🥗', gradientClass: 'from-emerald-50 to-green-100' }
  if (g.includes('中華') || g.includes('餃子') || g.includes('中国'))
    return { emoji: '🥟', gradientClass: 'from-red-50 to-orange-50' }
  if (g.includes('デザート') || g.includes('スイーツ') || g.includes('ケーキ'))
    return { emoji: '🍰', gradientClass: 'from-pink-50 to-rose-100' }
  return { emoji: '🍽️', gradientClass: 'from-orange-50 to-amber-100' }
}

interface Props {
  restaurant: RestaurantRow
  dist: Distribution
  countLabel: string
  imageUrl?: string
  variant?: 'featured' | 'compact'
}

export default function RestaurantCard({
  restaurant,
  dist,
  countLabel,
  imageUrl,
  variant = 'compact',
}: Props) {
  const { emoji, gradientClass } = getGenreInfo(restaurant.genre)
  const subtext = [restaurant.genre, restaurant.area].filter(Boolean).join(' · ')

  if (variant === 'featured') {
    return (
      <Link href={`/restaurants/${restaurant.id}`} className="block">
        <div className="overflow-hidden rounded-2xl border border-edge bg-surface shadow-sm transition-all duration-150 hover:shadow-md motion-safe:active:scale-[0.99]">
          {/* 写真エリア */}
          <div className="h-44 w-full overflow-hidden">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={restaurant.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientClass}`}
              >
                <span
                  className="text-7xl"
                  role="img"
                  aria-label={restaurant.genre ?? 'レストラン'}
                >
                  {emoji}
                </span>
              </div>
            )}
          </div>
          {/* 情報エリア */}
          <div className="p-4">
            <p className="text-base font-bold text-ink">{restaurant.name}</p>
            {subtext && <p className="mt-0.5 text-sm text-ink-sub">{subtext}</p>}
            <DistributionDisplay
              dist={dist}
              countLabel={countLabel}
              emptyMessage="まだ評価がありません"
            />
          </div>
        </div>
      </Link>
    )
  }

  // compact — 写真＋店名＋分布バー（横スクロール用）
  return (
    <Link href={`/restaurants/${restaurant.id}`} className="block">
      <div className="overflow-hidden rounded-2xl border border-edge bg-surface shadow-sm transition-all duration-150 hover:shadow-md motion-safe:active:scale-[0.99]">
        {/* 写真エリア（16:9） */}
        <div className="aspect-video w-full overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={restaurant.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientClass}`}
            >
              <span
                className="text-5xl"
                role="img"
                aria-label={restaurant.genre ?? 'レストラン'}
              >
                {emoji}
              </span>
            </div>
          )}
        </div>
        {/* 情報エリア（ジャンル・エリア省略） */}
        <div className="p-3">
          <p className="text-sm font-bold text-ink">{restaurant.name}</p>
          <DistributionDisplay
            dist={dist}
            countLabel={countLabel}
            emptyMessage="まだ評価がありません"
          />
        </div>
      </div>
    </Link>
  )
}
