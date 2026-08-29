export const RESTAURANT_AREAS = [
  '飯塚市中心部',
  '新飯塚',
  '二瀬',
  '幸袋',
  '穂波',
  '庄内',
  '頴田',
  '桂川',
  'その他',
] as const

export type RestaurantArea = (typeof RESTAURANT_AREAS)[number]
