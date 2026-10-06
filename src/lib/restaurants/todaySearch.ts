export const PARTY_VALUES = ['solo', 'pair', 'small_group', 'large_group'] as const
export type PartyValue = (typeof PARTY_VALUES)[number]

export const BUDGET_VALUES = [1000, 2000, 3000] as const
export type BudgetValue = (typeof BUDGET_VALUES)[number]

export const VIBE_VALUES = ['lively', 'relaxed', 'casual'] as const
export type VibeValue = (typeof VIBE_VALUES)[number]

export const FOOD_VALUES = ['teishoku', 'yakiniku', 'ramen', 'izakaya', 'cafe'] as const
export type FoodValue = (typeof FOOD_VALUES)[number]

export const FOOD_TO_GENRE: Record<FoodValue, string> = {
  teishoku: '定食',
  yakiniku: '焼肉',
  ramen: 'ラーメン',
  izakaya: '居酒屋',
  cafe: 'カフェ',
}

export const PARTY_LABEL: Record<PartyValue, string> = {
  solo: '1人',
  pair: '2人',
  small_group: '3〜4人',
  large_group: '5人以上',
}

export const BUDGET_LABEL: Record<BudgetValue, string> = {
  1000: '¥1,000以下',
  2000: '¥2,000以下',
  3000: '¥3,000以下',
}

export const VIBE_LABEL: Record<VibeValue, string> = {
  lively: 'にぎやか',
  relaxed: 'ゆっくり',
  casual: '気軽',
}

export const FOOD_LABEL: Record<FoodValue, string> = {
  teishoku: '定食',
  yakiniku: '焼肉',
  ramen: 'ラーメン',
  izakaya: '居酒屋',
  cafe: 'カフェ',
}

export type TodaySearchParams = {
  party: PartyValue | null
  budget: BudgetValue | null
  vibe: VibeValue | null
  food: FoodValue | null
  walkIn: boolean
  parking: boolean
  openNow: boolean
}

type RawParams = Record<string, string | string[] | undefined>

function getString(raw: RawParams, key: string): string {
  const v = raw[key]
  return ((Array.isArray(v) ? v[0] : v) ?? '').trim()
}

export function parseTodaySearchParams(raw: RawParams): TodaySearchParams {
  const partyRaw = getString(raw, 'party')
  const party = (PARTY_VALUES as readonly string[]).includes(partyRaw)
    ? (partyRaw as PartyValue)
    : null

  const budgetRaw = Number(getString(raw, 'budget'))
  const budget = (BUDGET_VALUES as readonly number[]).includes(budgetRaw)
    ? (budgetRaw as BudgetValue)
    : null

  const vibeRaw = getString(raw, 'vibe')
  const vibe = (VIBE_VALUES as readonly string[]).includes(vibeRaw)
    ? (vibeRaw as VibeValue)
    : null

  const foodRaw = getString(raw, 'food')
  const food = (FOOD_VALUES as readonly string[]).includes(foodRaw)
    ? (foodRaw as FoodValue)
    : null

  const walkIn = getString(raw, 'walk_in') === '1'
  const parking = getString(raw, 'parking') === '1'
  const openNow = getString(raw, 'open_now') === '1'

  return { party, budget, vibe, food, walkIn, parking, openNow }
}

export function serializeTodaySearchParams(params: TodaySearchParams): URLSearchParams {
  const p = new URLSearchParams()
  if (params.party) p.set('party', params.party)
  if (params.budget !== null) p.set('budget', String(params.budget))
  if (params.vibe) p.set('vibe', params.vibe)
  if (params.food) p.set('food', params.food)
  if (params.walkIn) p.set('walk_in', '1')
  if (params.parking) p.set('parking', '1')
  if (params.openNow) p.set('open_now', '1')
  return p
}

export function getActiveConditionLabels(params: TodaySearchParams): string[] {
  const labels: string[] = []
  if (params.party) labels.push(PARTY_LABEL[params.party])
  if (params.budget !== null) labels.push(BUDGET_LABEL[params.budget])
  if (params.vibe) labels.push(VIBE_LABEL[params.vibe])
  if (params.food) labels.push(FOOD_LABEL[params.food])
  if (params.walkIn) labels.push('予約なしOK')
  if (params.parking) labels.push('駐車場あり')
  if (params.openNow) labels.push('今すぐ開いている')
  return labels
}
