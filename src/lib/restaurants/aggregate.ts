// Pure computation logic for restaurant rating aggregation.
// No React, no UI — safe to import in both Server and Client Components.

export type RestaurantRow = {
  id: string
  name: string
  area: string | null
  genre: string | null
  created_at: string
}

export type ReviewRow = {
  restaurant_id: string
  rating: number
  user_id: string
}

export type ProfileRow = {
  user_id: string
  main_value_type: string | null
}

export type Distribution = {
  total: number
  counts: Record<1 | 2 | 3 | 4, number>
  percents: Record<1 | 2 | 3 | 4, number>
}

export type RestaurantWithDist = {
  restaurant: RestaurantRow
  dist: Distribution
}

// rating の濃淡 — 4=濃いオレンジ → 1=薄オレンジ。分布バーに使用。
export const RATING_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: 'bg-orange-700',
  3: 'bg-orange-500',
  2: 'bg-orange-400',
  1: 'bg-orange-200',
}

export const RATINGS = [4, 3, 2, 1] as const

export function buildProfileMap(profiles: ProfileRow[]): Map<string, string | null> {
  return new Map(profiles.map((p) => [p.user_id, p.main_value_type]))
}

/**
 * valueType が null のとき（全員表示）は null を返す。
 * null を受け取った computeDistribution は全ユーザーを対象とする。
 */
export function buildEligibleUserIds(
  profileMap: Map<string, string | null>,
  valueType: string | null,
): Set<string> | null {
  if (!valueType) return null
  return new Set(
    [...profileMap.entries()]
      .filter(([, type]) => type === valueType)
      .map(([id]) => id),
  )
}

export function computeDistribution(
  restaurantId: string,
  reviews: ReviewRow[],
  eligibleUserIds: Set<string> | null,
): Distribution {
  const counts: Record<1 | 2 | 3 | 4, number> = { 4: 0, 3: 0, 2: 0, 1: 0 }

  const relevant = reviews.filter(
    (r) =>
      r.restaurant_id === restaurantId &&
      (eligibleUserIds === null || eligibleUserIds.has(r.user_id)),
  )

  const total = relevant.length
  if (total === 0) {
    return { total: 0, counts, percents: { 4: 0, 3: 0, 2: 0, 1: 0 } }
  }

  for (const r of relevant) {
    counts[r.rating as 1 | 2 | 3 | 4]++
  }

  return {
    total,
    counts,
    percents: {
      4: Math.round((counts[4] / total) * 100),
      3: Math.round((counts[3] / total) * 100),
      2: Math.round((counts[2] / total) * 100),
      1: Math.round((counts[1] / total) * 100),
    },
  }
}

/**
 * 高評価率（rating 4+3）の降順でソートする。
 * 評価が0件の店は末尾（created_at 降順）。
 * 同率の場合は母数降順 → created_at 降順。
 * 浮動小数点誤差を避けるため交差乗算で比較する。
 */
export function sortRestaurants(
  restaurants: RestaurantRow[],
  reviews: ReviewRow[],
  eligibleUserIds: Set<string> | null,
): RestaurantWithDist[] {
  const withDist = restaurants.map((r) => ({
    restaurant: r,
    dist: computeDistribution(r.id, reviews, eligibleUserIds),
  }))

  return withDist.sort((a, b) => {
    const aTotal = a.dist.total
    const bTotal = b.dist.total

    if (aTotal === 0 && bTotal === 0) {
      return (
        new Date(b.restaurant.created_at).getTime() -
        new Date(a.restaurant.created_at).getTime()
      )
    }
    if (aTotal === 0) return 1
    if (bTotal === 0) return -1

    const aHigh = a.dist.counts[4] + a.dist.counts[3]
    const bHigh = b.dist.counts[4] + b.dist.counts[3]
    const cross = bHigh * aTotal - aHigh * bTotal
    if (cross !== 0) return cross

    if (bTotal !== aTotal) return bTotal - aTotal

    return (
      new Date(b.restaurant.created_at).getTime() -
      new Date(a.restaurant.created_at).getTime()
    )
  })
}
