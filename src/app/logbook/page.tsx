import Link from 'next/link'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { RATING_LABELS, RATING_BG, RATING_TEXT, RATING_BORDER } from '@/lib/rating/colors'
import RatingBadgeIcon from './RatingBadgeIcon'
import { buildVisitCards } from './buildVisitCards'
import LogbookList from './LogbookList'
import CalendarTab from './CalendarTab'
import MapTab from './MapTab'
import type { LogbookStats, VisitCursor, CalendarMonthSummary, VisitCard } from './types'

// ── Types ────────────────────────────────────────────────────────────────────

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type RawVisit = {
  id: string; restaurant_id: string; visit_date: string | null; rating: number
  comment: string | null; image_path: string | null; reason_keys: string[]
  label_keys: string[]; created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseSort(raw: string | string[] | undefined): 'newest' | 'oldest' {
  return raw === 'oldest' ? 'oldest' : 'newest'
}

function parseRating(raw: string | string[] | undefined): number | null {
  const n = Number(raw)
  return n >= 1 && n <= 4 ? n : null
}

function parseTab(raw: string | string[] | undefined): 'list' | 'calendar' | 'map' {
  if (raw === 'calendar') return 'calendar'
  if (raw === 'map') return 'map'
  return 'list'
}

function getJSTMonth(): number {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCMonth() + 1
}

function getJSTYearMonth(): { year: number; month: number } {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
}

function getJSTToday(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseMonthParam(raw: string | string[] | undefined): { year: number; month: number } | null {
  if (typeof raw !== 'string') return null
  const match = /^(\d{4})-(\d{2})$/.exec(raw)
  if (!match) return null
  const year = parseInt(match[1])
  const month = parseInt(match[2])
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null
  return { year, month }
}

function parseDateParam(raw: string | string[] | undefined, year: number, month: number): string | null {
  if (typeof raw !== 'string') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const [y, m, d] = raw.split('-').map(Number)
  if (y !== year || m !== month || d < 1 || d > 31) return null
  return raw
}

const PAGE_SIZE = 20

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function LogbookPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const tab = parseTab(sp.tab)
  const ratingFilter = parseRating(sp.rating)
  const sort = parseSort(sp.sort)

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // ── Aggregated stats (always fetched — restaurant counts needed in both tabs) ──
  const { data: statsData } = await supabase.rpc('get_logbook_stats')
  const rawStats = (statsData as unknown as LogbookStats[] | null)?.[0] ?? null
  const totalCount      = Number(rawStats?.total_count      ?? 0)
  const thisMonthCount  = Number(rawStats?.this_month_count ?? 0)
  const prevMonthCount  = Number(rawStats?.prev_month_count ?? 0)
  const restaurantCounts = (rawStats?.restaurant_counts ?? {}) as Record<string, number>
  const monthDiff = thisMonthCount - prevMonthCount
  const currentMonth = getJSTMonth()

  // ── List tab data (only when viewing list) ────────────────────────────────
  let initialItems: VisitCard[] = []
  let encodedCursor: string | null = null
  let initialHasMore = false

  if (tab === 'list') {
    const { data: rpcRows, error: rpcError } = await supabase.rpc('get_logbook_visits', {
      p_sort: sort,
      p_rating: ratingFilter,
      p_first_page: true,
      p_limit: PAGE_SIZE,
    })
    if (rpcError) throw new Error(`LogbookPage: ${rpcError.message}`)

    const rawVisits = (rpcRows ?? []) as RawVisit[]
    initialItems = await buildVisitCards(supabase, rawVisits)

    const lastItem = rawVisits.at(-1)
    const initialCursor: VisitCursor | null = lastItem && rawVisits.length === PAGE_SIZE
      ? { vd: lastItem.visit_date, ca: lastItem.created_at, id: lastItem.id }
      : null
    encodedCursor = initialCursor
      ? Buffer.from(JSON.stringify(initialCursor)).toString('base64')
      : null
    initialHasMore = rawVisits.length === PAGE_SIZE
  }

  // ── Calendar tab data (only when viewing calendar) ────────────────────────
  const jstYM = getJSTYearMonth()
  let calYear = jstYM.year
  let calMonth = jstYM.month
  let calendarSummary: CalendarMonthSummary = { month_count: 0, prev_month_count: 0, day_counts: {} }
  let initialCalDate: string | null = null
  let initialCalVisits: VisitCard[] = []

  if (tab === 'calendar') {
    const monthParam = parseMonthParam(sp.month)
    if (monthParam) {
      const isFuture = monthParam.year > jstYM.year
        || (monthParam.year === jstYM.year && monthParam.month > jstYM.month)
      if (!isFuture) {
        calYear = monthParam.year
        calMonth = monthParam.month
      }
    }

    type CalRaw = { month_count: number; prev_month_count: number; day_counts: Record<string, number> }
    const { data: calData } = await supabase.rpc('get_logbook_calendar_month', {
      p_year: calYear,
      p_month: calMonth,
    })
    const rawCal = (calData as unknown as CalRaw[] | null)?.[0]
    if (rawCal) {
      calendarSummary = {
        month_count: Number(rawCal.month_count ?? 0),
        prev_month_count: Number(rawCal.prev_month_count ?? 0),
        day_counts: (rawCal.day_counts ?? {}) as Record<string, number>,
      }
    }

    // Determine initial selected date
    const isCurrentCalMonth = calYear === jstYM.year && calMonth === jstYM.month
    const dateParam = parseDateParam(sp.date, calYear, calMonth)

    if (dateParam) {
      initialCalDate = dateParam
    } else if (isCurrentCalMonth) {
      initialCalDate = getJSTToday()
    } else {
      // Most recent visit day in this month
      initialCalDate = Object.keys(calendarSummary.day_counts).sort().at(-1) ?? null
    }

    // Fetch initial visits for the selected date
    if (initialCalDate) {
      const { data: visitRows } = await supabase
        .from('restaurant_visits')
        .select('id, restaurant_id, visit_date, rating, comment, image_path, reason_keys, label_keys, created_at')
        .eq('user_id', user.id)
        .eq('visit_date', initialCalDate)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })

      initialCalVisits = await buildVisitCards(supabase, (visitRows ?? []) as RawVisit[])
    }
  }

  // ── URL helpers ───────────────────────────────────────────────────────────

  function tabHref(t: 'list' | 'calendar' | 'map') {
    if (t === 'list') {
      const p = new URLSearchParams()
      if (ratingFilter !== null) p.set('rating', String(ratingFilter))
      if (sort !== 'newest') p.set('sort', sort)
      const qs = p.toString()
      return qs ? `/logbook?${qs}` : '/logbook'
    }
    if (t === 'calendar') return '/logbook?tab=calendar'
    return `/logbook?tab=${t}`
  }

  function filterHref(r: number | null) {
    const p = new URLSearchParams()
    if (r !== null) p.set('rating', String(r))
    if (sort !== 'newest') p.set('sort', sort)
    const qs = p.toString()
    return qs ? `/logbook?${qs}` : '/logbook'
  }

  function sortHref(s: 'newest' | 'oldest') {
    const p = new URLSearchParams()
    if (ratingFilter !== null) p.set('rating', String(ratingFilter))
    if (s !== 'newest') p.set('sort', s)
    const qs = p.toString()
    return qs ? `/logbook?${qs}` : '/logbook'
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-dvh bg-canvas pb-24">
      <div className="mx-auto max-w-md px-4">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between pb-4 pt-6">
          <div>
            <h1 className="text-[26px] font-extrabold leading-tight text-ink">記録帳</h1>
            <p className="mt-1 text-[13px] text-ink-sub">自分の記録をふり返る</p>
          </div>
          <div className="pt-1">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-ink-sub/50" aria-hidden="true">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
        </div>

        {/* ── 3-tab switcher ────────────────────────────────────────────── */}
        <div className="flex gap-1 rounded-2xl border border-edge bg-surface p-1">
          {(
            [
              {
                key: 'list' as const,
                label: '一覧',
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <line x1="9" y1="6" x2="20" y2="6" />
                    <line x1="9" y1="12" x2="20" y2="12" />
                    <line x1="9" y1="18" x2="20" y2="18" />
                    <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
                  </svg>
                ),
              },
              {
                key: 'calendar' as const,
                label: 'カレンダー',
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                ),
              },
              {
                key: 'map' as const,
                label: 'マップ',
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="10" r="3" />
                    <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z" />
                  </svg>
                ),
              },
            ] as const
          ).map(({ key, label, icon }) => {
            const isActive = tab === key
            return (
              <Link
                key={key}
                href={tabHref(key)}
                replace
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors ${
                  isActive
                    ? 'bg-terra text-white'
                    : 'text-ink-sub hover:text-ink'
                }`}
              >
                {icon}
                <span>{label}</span>
              </Link>
            )
          })}
        </div>

        {/* ── Rating filter row (list tab only) ─────────────────────────── */}
        {tab === 'list' && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href={filterHref(null)}
              replace
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-xs font-semibold transition-colors ${
                ratingFilter === null
                  ? 'bg-terra text-white'
                  : 'border border-edge bg-surface text-ink-sub hover:text-ink'
              }`}
            >
              すべて
            </Link>
            {([4, 3, 2, 1] as const).map((r) => (
              <Link
                key={r}
                href={filterHref(r)}
                replace
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                  ratingFilter === r
                    ? `${RATING_BG[r]} ${RATING_TEXT[r]} ${RATING_BORDER[r]}`
                    : 'border-edge bg-surface text-ink-sub hover:text-ink'
                }`}
              >
                <RatingBadgeIcon rating={r} />
                {RATING_LABELS[r]}
              </Link>
            ))}
          </div>
        )}

        {/* ── Calendar tab ─────────────────────────────────────────────── */}
        {tab === 'calendar' && (
          <CalendarTab
            key={`${calYear}-${calMonth}`}
            year={calYear}
            month={calMonth}
            summary={calendarSummary}
            initialDate={initialCalDate}
            initialVisits={initialCalVisits}
            restaurantCounts={restaurantCounts}
          />
        )}

        {/* ── Map tab ───────────────────────────────────────────────────── */}
        {tab === 'map' && <MapTab />}

        {/* ── List tab content ─────────────────────────────────────────── */}
        {tab === 'list' && (
          <>
            {/* Monthly summary */}
            <div className="mt-4 flex overflow-hidden rounded-2xl border border-edge bg-surface shadow-[0_2px_8px_rgba(98,55,31,0.06)]">
              <div className="flex flex-1 items-center gap-3 px-4 py-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terra/10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div>
                  <p className="text-[13px] font-bold text-ink">{currentMonth}月の記録</p>
                  <p className="mt-0.5 leading-none">
                    <span className="text-[27px] font-extrabold tabular-nums text-ink">{thisMonthCount}</span>
                    <span className="ml-1 text-sm font-semibold text-ink">件</span>
                  </p>
                </div>
              </div>
              <div className="my-3 w-px shrink-0 bg-edge" />
              <div className="flex min-w-[108px] flex-col items-center justify-center gap-1 px-3 py-3.5">
                <div className="flex items-center gap-1.5">
                  <svg
                    width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke={monthDiff >= 0 ? '#F97316' : '#EF4444'}
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {monthDiff >= 0
                      ? <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>
                      : <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></>
                    }
                  </svg>
                  <span className="text-[11px] text-ink-sub">先月より</span>
                </div>
                <p className={`text-[22px] font-extrabold tabular-nums leading-none ${
                  monthDiff > 0 ? 'text-terra' : monthDiff < 0 ? 'text-red-500' : 'text-ink-sub'
                }`}>
                  {monthDiff > 0 ? '+' : ''}{monthDiff}
                  <span className="ml-0.5 text-xs font-semibold">件</span>
                </p>
              </div>
            </div>

            {/* List header */}
            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-[17px] font-bold text-ink">記録一覧</span>
                <span className="text-xs text-ink-sub">（全{totalCount}件）</span>
              </div>
              <div className="flex overflow-hidden rounded-full border border-edge bg-surface">
                {(['newest', 'oldest'] as const).map((s) => (
                  <Link
                    key={s}
                    href={sortHref(s)}
                    replace
                    className={`flex items-center gap-1 px-3 py-2 text-[11px] font-semibold transition-colors ${
                      sort === s ? 'bg-terra/10 text-terra' : 'text-ink-sub hover:text-ink'
                    }`}
                  >
                    {s === 'newest' && sort === 'newest' && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 20V4M5 11l7-7 7 7" />
                      </svg>
                    )}
                    {s === 'oldest' && sort === 'oldest' && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 4v16M5 13l7 7 7-7" />
                      </svg>
                    )}
                    {s === 'newest' ? '新しい順' : '古い順'}
                  </Link>
                ))}
              </div>
            </div>

            {/* LogbookList (Client Component) — key resets state on filter/sort change */}
            <LogbookList
              key={`${sort}-${ratingFilter ?? 'all'}`}
              initialItems={initialItems}
              initialCursor={encodedCursor}
              initialHasMore={initialHasMore}
              sort={sort}
              ratingFilter={ratingFilter}
              restaurantCounts={restaurantCounts}
              totalCount={totalCount}
            />
          </>
        )}

      </div>
      <BottomNav />
    </main>
  )
}
