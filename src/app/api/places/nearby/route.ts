import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { nearbyGooglePlaces } from '@/lib/places/google'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { latitude, longitude } = body as { latitude?: unknown; longitude?: unknown }

  const lat = typeof latitude === 'number' ? latitude : Number(latitude)
  const lng = typeof longitude === 'number' ? longitude : Number(longitude)

  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  const places = await nearbyGooglePlaces(lat, lng)
  return NextResponse.json({ places }, { headers: { 'Cache-Control': 'no-store' } })
}
