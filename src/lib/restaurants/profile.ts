export type RestaurantProfileRow = {
  restaurant_id: string
  label_key: string
  label_name: string
  category: 'occasion' | 'atmosphere' | 'experience'
  sort_order: number
  vote_count: number
  eligible_review_count: number
  raw_share: number | null  // NULL when eligible_review_count = 0
  evidence_weight: number
}

export function groupProfileByRestaurant(
  rows: RestaurantProfileRow[],
): Map<string, RestaurantProfileRow[]> {
  const map = new Map<string, RestaurantProfileRow[]>()
  for (const row of rows) {
    const existing = map.get(row.restaurant_id) ?? []
    existing.push(row)
    map.set(row.restaurant_id, existing)
  }
  return map
}

// Returns top N labels sorted by selection_rate DESC, then category order, then sort_order.
// Excludes labels with no votes or no sample data.
// Confidence is the same for all labels in a restaurant, so it is not used as a tie-breaker.
export function getTopLabels(
  rows: RestaurantProfileRow[],
  n = 3,
): RestaurantProfileRow[] {
  const CATEGORY_ORDER: Record<string, number> = { occasion: 1, atmosphere: 2, experience: 3 }
  return rows
    .filter(r => r.vote_count > 0 && r.eligible_review_count > 0 && r.raw_share !== null)
    .sort((a, b) => {
      const rateDiff = (b.raw_share ?? 0) - (a.raw_share ?? 0)
      if (rateDiff !== 0) return rateDiff
      const catDiff = (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9)
      if (catDiff !== 0) return catDiff
      return a.sort_order - b.sort_order
    })
    .slice(0, n)
}
