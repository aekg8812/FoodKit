import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildVisitCards } from '@/app/logbook/buildVisitCards'
import type { VisitCard } from '@/app/logbook/types'

type RawVisit = {
  id: string
  restaurant_id: string
  visit_date: string | null
  rating: number
  comment: string | null
  image_path: string | null
  reason_keys: string[]
  label_keys: string[]
  created_at: string
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const date = sp.get('date') ?? ''

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }
  const [y, m, d] = date.split('-').map(Number)
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: rows, error } = await supabase
    .from('restaurant_visits')
    .select('id, restaurant_id, visit_date, rating, comment, image_path, reason_keys, label_keys, created_at')
    .eq('user_id', user.id)
    .eq('visit_date', date)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rawVisits = (rows ?? []) as RawVisit[]
  const items: VisitCard[] = await buildVisitCards(supabase, rawVisits)

  return NextResponse.json(items)
}
