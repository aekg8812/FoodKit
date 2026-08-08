// ジャンル選択式対応: V1の候補を一箇所で管理し、後から追加・並び替えしやすくする
export const RESTAURANT_GENRES = [
  'ラーメン',
  '定食・食堂',
  'カフェ',
  '居酒屋',
  '焼肉',
  '寿司',
  '和食',
  '洋食',
  '中華',
  'カレー',
  '麺類',
  'スイーツ',
  'ファストフード',
  'その他',
] as const

export type RestaurantGenre = (typeof RESTAURANT_GENRES)[number]
