import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchGooglePlaces } from '@/lib/places/google'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ places: [] }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ places: [] }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ places: [] }, { status: 400 })
  }

  const { query, lat, lng } = body as { query?: unknown; lat?: unknown; lng?: unknown }

  if (typeof query !== 'string') {
    return NextResponse.json({ places: [] })
  }
  const trimmed = query.trim()
  if (trimmed.length < 2 || trimmed.length > 200) {
    return NextResponse.json({ places: [] })
  }

  // Validate coordinates — invalid values silently fall back to Iizuka; never log values
  let validLat: number | undefined
  let validLng: number | undefined
  if (lat !== undefined && lng !== undefined) {
    const latNum = typeof lat === 'number' ? lat : Number(lat)
    const lngNum = typeof lng === 'number' ? lng : Number(lng)
    if (
      Number.isFinite(latNum) &&
      latNum >= -90 &&
      latNum <= 90 &&
      Number.isFinite(lngNum) &&
      lngNum >= -180 &&
      lngNum <= 180
    ) {
      validLat = latNum
      validLng = lngNum
    }
  }

  const places = await searchGooglePlaces(trimmed, validLat, validLng)
  return NextResponse.json({ places })
}
