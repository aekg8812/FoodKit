import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildVisitCards } from '@/app/logbook/buildVisitCards'
import type { LogbookPageResponse, VisitCursor } from '@/app/logbook/types'

const PAGE_SIZE = 20

function decodeCursor(encoded: string): VisitCursor | null {
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf-8')
    const parsed = JSON.parse(json) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).ca !== 'string' ||
      typeof (parsed as Record<string, unknown>).id !== 'string'
    ) return null
    const p = parsed as Record<string, unknown>
    return {
      vd: typeof p.vd === 'string' ? p.vd : null,
      ca: p.ca as string,
      id: p.id as string,
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const sort = sp.get('sort') === 'oldest' ? 'oldest' : 'newest'
  const ratingRaw = Number(sp.get('rating'))
  const rating = ratingRaw >= 1 && ratingRaw <= 4 ? ratingRaw : null
  const encodedCursor = sp.get('cursor') ?? ''

  const cursor = decodeCursor(encodedCursor)
  if (!cursor) {
    return NextResponse.json({ error: 'invalid cursor' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: rpcRows, error } = await supabase.rpc('get_logbook_visits', {
    p_sort: sort,
    p_rating: rating,
    p_first_page: false,
    p_cursor_vd: cursor.vd,
    p_cursor_ca: cursor.ca,
    p_cursor_id: cursor.id,
    p_limit: PAGE_SIZE,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rawVisits = (rpcRows ?? []) as Parameters<typeof buildVisitCards>[1]
  const items = await buildVisitCards(supabase, rawVisits)

  const lastItem = items.at(-1)
  const nextCursor: VisitCursor | null = lastItem && items.length === PAGE_SIZE
    ? { vd: lastItem.visitDate, ca: lastItem.createdAt, id: lastItem.id }
    : null
  const encodedNext = nextCursor
    ? Buffer.from(JSON.stringify(nextCursor)).toString('base64')
    : null

  const body: LogbookPageResponse = {
    items,
    next_cursor: encodedNext,
    has_more: nextCursor !== null,
  }
  return NextResponse.json(body)
}
