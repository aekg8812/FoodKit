export type LogbookStats = {
  total_count: number
  this_month_count: number
  prev_month_count: number
  restaurant_counts: Record<string, number>
}

export type VisitCard = {
  id: string
  restaurantId: string
  visitDate: string | null  // YYYY-MM-DD
  rating: 1 | 2 | 3 | 4
  comment: string | null
  imageUrl: string | null
  reasonKeys: string[]
  labelKeys: string[]
  createdAt: string  // ISO 8601 timestamptz
  restaurantName: string
  restaurantSource: string
  restaurantGenre: string | null
  restaurantArea: string | null
}

export type VisitCursor = {
  vd: string | null  // visit_date YYYY-MM-DD or null
  ca: string         // created_at ISO string
  id: string         // visit UUID
}

export type LogbookPageResponse = {
  items: VisitCard[]
  next_cursor: string | null  // base64-encoded VisitCursor, or null if no more
  has_more: boolean
}

export type CalendarMonthSummary = {
  month_count: number
  prev_month_count: number
  day_counts: Record<string, number>  // YYYY-MM-DD → visit count
}

export type MapPin = {
  restaurantId: string
  name: string
  lat: number | null
  lng: number | null
  hasLocation: boolean
  visitCount: number
  latestRating: 1 | 2 | 3 | 4
  source: string
  externalPlaceId: string | null
  latestImageSigned: string | null
  address: string | null
}

export type MapPersonalStats = {
  uniqueRestaurantCount: number
  totalVisitCount: number
  activeMonthCount: number
}

export type MapGroupInfo = {
  id: string
  name: string
  memberCount: number
}
