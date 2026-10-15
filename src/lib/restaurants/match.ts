export const MATCH_ALGORITHM_VERSION = 'match_v1'

export type FoodKitMatchRow = {
  restaurant_id: string
  match_score: number | null
  data_state: 'insufficient' | 'prior_only' | 'behavior'
  match_confidence: number | null
  raw_alignment: number | null
  user_reliability: number | null
  restaurant_reliability: number
  scored_dimension_count: number
  positive_contributor_keys: string[] | null
  negative_contributor_keys: string[] | null
  algorithm_version: string
}

// Japanese display names for all 12 restaurant label keys.
export const LABEL_NAMES: Record<string, string> = {
  solo:        'ひとり向き',
  friends:     '友達向き',
  date:        'デート向き',
  large_group: '大人数向き',
  calm:        '落ち着く',
  lively:      'にぎやか',
  stylish:     'おしゃれ',
  casual:      'カジュアル',
  quick:       'サクッと利用',
  long_stay:   '長居しやすい',
  hearty:      'がっつり',
  photogenic:  '写真映え',
}

// Resolve a label key to its Japanese display name.
export function getLabelName(key: string): string {
  return LABEL_NAMES[key] ?? key
}

// Find the match row for a specific restaurant from the RPC result array.
export function findMatchRow(
  rows: FoodKitMatchRow[],
  restaurantId: string,
): FoodKitMatchRow | undefined {
  return rows.find(r => r.restaurant_id === restaurantId)
}
