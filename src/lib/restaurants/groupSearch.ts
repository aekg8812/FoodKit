import {
  FOOD_VALUES,
  FOOD_TO_GENRE,
  VIBE_VALUES,
  VIBE_LABEL,
  TRANSPORT_VALUES,
  TRAVEL_VALUES,
  getMaxDistanceKm,
  type FoodValue,
  type VibeValue,
  type TransportValue,
  type TravelValue,
} from './todaySearch'

export const GROUP_BUDGET_VALUES = [1000, 2000, 2500, 3000] as const
export type GroupBudgetValue = (typeof GROUP_BUDGET_VALUES)[number]
export const GROUP_BUDGET_LABEL: Record<GroupBudgetValue, string> = {
  1000: '〜¥1,000',
  2000: '〜¥2,000',
  2500: '〜¥2,500',
  3000: '〜¥3,000',
}

export const TRANSPORT_LABEL: Record<TransportValue, string> = {
  walk: '徒歩',
  bike: '自転車',
  car: '車',
}

export const TRAVEL_LABEL: Record<TravelValue, string> = {
  5: '5分以内',
  10: '10分以内',
  15: '15分以内',
}

export type GroupSearchParams = {
  budget: GroupBudgetValue | null
  food: FoodValue | null
  vibe: VibeValue | null
  meal: 'lunch' | 'dinner' | null
  walkIn: boolean
  parking: boolean
  openNow: boolean
  transport: TransportValue | null
  travel: TravelValue | null
}

type RawParams = Record<string, string | string[] | undefined>

function getStr(raw: RawParams, key: string): string {
  const v = raw[key]
  return ((Array.isArray(v) ? v[0] : v) ?? '').trim()
}

export function parseGroupSearchParams(raw: RawParams): GroupSearchParams {
  const budgetRaw = Number(getStr(raw, 'budget'))
  const budget = (GROUP_BUDGET_VALUES as readonly number[]).includes(budgetRaw)
    ? (budgetRaw as GroupBudgetValue)
    : null

  const foodRaw = getStr(raw, 'food')
  const food = (FOOD_VALUES as readonly string[]).includes(foodRaw) ? (foodRaw as FoodValue) : null

  const vibeRaw = getStr(raw, 'vibe')
  const vibe = (VIBE_VALUES as readonly string[]).includes(vibeRaw) ? (vibeRaw as VibeValue) : null

  const mealRaw = getStr(raw, 'meal')
  const meal = mealRaw === 'lunch' || mealRaw === 'dinner' ? mealRaw : null

  const walkIn = getStr(raw, 'walk_in') === '1'
  const parking = getStr(raw, 'parking') === '1'
  const openNow = getStr(raw, 'open_now') === '1'

  const transportRaw = getStr(raw, 'transport')
  const transport = (TRANSPORT_VALUES as readonly string[]).includes(transportRaw)
    ? (transportRaw as TransportValue)
    : null

  const travelRaw = Number(getStr(raw, 'travel'))
  const travel = (TRAVEL_VALUES as readonly number[]).includes(travelRaw)
    ? (travelRaw as TravelValue)
    : null

  return { budget, food, vibe, meal, walkIn, parking, openNow, transport, travel }
}

export function serializeGroupSearchParams(params: GroupSearchParams): URLSearchParams {
  const p = new URLSearchParams()
  if (params.budget !== null) p.set('budget', String(params.budget))
  if (params.food) p.set('food', params.food)
  if (params.vibe) p.set('vibe', params.vibe)
  if (params.meal) p.set('meal', params.meal)
  if (params.walkIn) p.set('walk_in', '1')
  if (params.parking) p.set('parking', '1')
  if (params.openNow) p.set('open_now', '1')
  if (params.transport) p.set('transport', params.transport)
  if (params.travel !== null) p.set('travel', String(params.travel))
  return p
}

export function getGroupActiveLabels(params: GroupSearchParams): string[] {
  const labels: string[] = []
  if (params.budget !== null) labels.push(GROUP_BUDGET_LABEL[params.budget])
  if (params.food) labels.push(FOOD_TO_GENRE[params.food])
  if (params.vibe === 'lively') labels.push('にぎやか')
  if (params.vibe === 'relaxed') labels.push('ゆっくり')
  if (params.vibe === 'casual') labels.push('気軽')
  if (params.meal === 'lunch') labels.push('ランチ')
  if (params.meal === 'dinner') labels.push('ディナー')
  if (params.walkIn) labels.push('飛び込みOK')
  if (params.parking) labels.push('駐車場あり')
  if (params.openNow) labels.push('営業中')
  if (params.transport && params.travel !== null) {
    labels.push(`${TRANSPORT_LABEL[params.transport]}${TRAVEL_LABEL[params.travel]}`)
  }
  return labels
}

export {
  FOOD_VALUES,
  FOOD_TO_GENRE,
  VIBE_VALUES,
  VIBE_LABEL,
  TRANSPORT_VALUES,
  TRAVEL_VALUES,
  getMaxDistanceKm,
}
export type { FoodValue, VibeValue, TransportValue, TravelValue }
