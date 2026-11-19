'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { VisitCardItem } from './VisitCardItem'
import type { VisitCard, CalendarMonthSummary } from './types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function padTwo(n: number) { return String(n).padStart(2, '0') }

function getJSTInfo() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  return {
    jstYear: y,
    jstMonth: m,
    today: `${y}-${padTwo(m)}-${padTwo(day)}`,
  }
}

function prevMonth(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

function nextMonth(year: number, month: number) {
  if (month === 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

function getCalendarCells(year: number, month: number): (number | null)[] {
  const firstDow = new Date(Date.UTC(year, month - 1, 1, 12)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

function chunkWeeks(cells: (number | null)[]): (number | null)[][] {
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// ── Props ────────────────────────────────────────────────────────────────────

type Props = {
  year: number
  month: number
  summary: CalendarMonthSummary
  initialDate: string | null
  initialVisits: VisitCard[]
  restaurantCounts: Record<string, number>
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CalendarTab({
  year,
  month,
  summary,
  initialDate,
  initialVisits,
  restaurantCounts,
}: Props) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate)
  const [dayVisits, setDayVisits] = useState<VisitCard[]>(initialVisits)
  const [loadingVisits, setLoadingVisits] = useState(false)
  const [visitsError, setVisitsError] = useState<string | null>(null)

  const { jstYear, jstMonth, today } = getJSTInfo()
  const isCurrentMonth = year === jstYear && month === jstMonth
  const cells = getCalendarCells(year, month)
  const weeks = chunkWeeks(cells)
  const dayCounts = summary.day_counts
  const monthDiff = summary.month_count - summary.prev_month_count

  // ── Month navigation ──────────────────────────────────────────────────────

  function goToPrevMonth() {
    const prev = prevMonth(year, month)
    router.push(`/logbook?tab=calendar&month=${prev.year}-${padTwo(prev.month)}`, { scroll: false })
  }

  function goToNextMonth() {
    if (isCurrentMonth) return
    const next = nextMonth(year, month)
    router.push(`/logbook?tab=calendar&month=${next.year}-${padTwo(next.month)}`, { scroll: false })
  }

  // ── Date selection ────────────────────────────────────────────────────────

  const handleDateSelect = useCallback(async (dateStr: string) => {
    if (dateStr === selectedDate && !visitsError) return
    setSelectedDate(dateStr)
    setVisitsError(null)

    // Silently update URL for refresh/back support
    const params = new URLSearchParams({
      tab: 'calendar',
      month: `${year}-${padTwo(month)}`,
      date: dateStr,
    })
    window.history.replaceState({}, '', `/logbook?${params.toString()}`)

    // Skip fetch for days with no visits
    if ((dayCounts[dateStr] ?? 0) === 0) {
      setDayVisits([])
      return
    }

    setLoadingVisits(true)
    try {
      const res = await fetch(`/api/logbook/calendar/visits?date=${dateStr}`)
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json() as VisitCard[]
      setDayVisits(data)
    } catch {
      setVisitsError('記録の読み込みに失敗しました')
      setDayVisits([])
    } finally {
      setLoadingVisits(false)
    }
  }, [selectedDate, visitsError, dayCounts, year, month])

  // ── Selected date helpers ─────────────────────────────────────────────────

  function formatDayLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const showYear = y !== year
    return showYear ? `${y}年${m}月${d}日の記録` : `${m}月${d}日の記録`
  }

  const selectedCount = selectedDate ? (dayCounts[selectedDate] ?? 0) : 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Monthly summary card */}
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
            <p className="text-[13px] font-bold text-ink">{month}月の記録</p>
            <p className="mt-0.5 leading-none">
              <span className="text-[27px] font-extrabold tabular-nums text-ink">{summary.month_count}</span>
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

      {/* Month navigator */}
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={goToPrevMonth}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-surface shadow-[0_1px_4px_rgba(98,55,31,0.07)] transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/40"
          aria-label="前の月へ"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-ink" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <h2 className="text-[21px] font-extrabold text-ink">
          {year}年{month}月
        </h2>

        <button
          type="button"
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-surface shadow-[0_1px_4px_rgba(98,55,31,0.07)] transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/40 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="次の月へ"
          aria-disabled={isCurrentMonth}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-ink" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="mt-3 w-full overflow-hidden rounded-[18px] border border-edge bg-surface shadow-[0_3px_12px_rgba(98,55,31,0.05)]">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-edge">
          {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
            <div
              key={d}
              className={`py-[7px] text-center text-[12px] font-bold ${i === 0 || i === 6 ? 'text-terra' : 'text-ink'}`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, wi) => (
          <div key={wi} className={`grid grid-cols-7 ${wi > 0 ? 'border-t border-edge/50' : ''}`}>
            {week.map((day, ci) => {
              if (day === null) {
                return <div key={`e-${wi}-${ci}`} className="h-[48px]" aria-hidden="true" />
              }
              const dateStr = `${year}-${padTwo(month)}-${padTwo(day)}`
              const count = dayCounts[dateStr] ?? 0
              const isSelected = selectedDate === dateStr
              const isToday = isCurrentMonth && dateStr === today
              const isSundaySat = ci === 0 || ci === 6

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => void handleDateSelect(dateStr)}
                  className="flex h-[48px] flex-col items-center justify-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-terra/50"
                  aria-label={`${year}年${month}月${day}日、${count}件の記録`}
                  aria-pressed={isSelected}
                >
                  <span
                    className={[
                      'flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-[15px] leading-none',
                      isSelected
                        ? 'bg-terra font-bold text-white'
                        : isToday
                          ? 'font-bold text-terra ring-1 ring-terra/60'
                          : isSundaySat
                            ? 'font-semibold text-terra'
                            : 'font-semibold text-ink',
                    ].join(' ')}
                  >
                    {day}
                  </span>
                  {count > 0 && (
                    <div className="flex gap-[3px]">
                      {Array.from({ length: Math.min(count, 3) }).map((_, di) => (
                        <span
                          key={di}
                          className={`block h-[5px] w-[5px] rounded-full ${isSelected ? 'bg-white' : 'bg-terra'}`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Selected day visits section */}
      <section
        className="mt-6"
        aria-label={selectedDate ? formatDayLabel(selectedDate) : 'この月の記録はありません'}
        aria-live="polite"
      >
        {selectedDate ? (
          <>
            {/* Section header */}
            <div className="flex items-center gap-2">
              <h2 className="text-[19px] font-extrabold text-ink">
                {formatDayLabel(selectedDate)}
              </h2>
              <span className="inline-flex items-center rounded-full bg-terra/10 px-3 py-1 text-[13px] font-bold text-terra">
                {selectedCount}件
              </span>
            </div>

            {/* Visit cards */}
            <div className="mt-3 space-y-3">
              {loadingVisits ? (
                Array.from({ length: Math.min(selectedCount || 1, 2) }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[112px] animate-pulse rounded-[18px] border border-edge bg-surface"
                  />
                ))
              ) : visitsError ? (
                <div className="rounded-2xl border border-edge bg-surface px-4 py-6 text-center">
                  <p className="text-sm text-ink-sub">{visitsError}</p>
                  <button
                    type="button"
                    onClick={() => void handleDateSelect(selectedDate)}
                    className="mt-3 text-sm font-medium text-terra underline"
                  >
                    再試行
                  </button>
                </div>
              ) : dayVisits.length > 0 ? (
                dayVisits.map((card) => (
                  <VisitCardItem
                    key={card.id}
                    card={card}
                    visitCount={restaurantCounts[card.restaurantId] ?? 1}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-edge bg-surface px-4 py-8 text-center">
                  <p className="text-sm text-ink-sub">この日の記録はありません</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-edge bg-surface px-4 py-10 text-center">
            <p className="text-sm text-ink-sub">この月の記録はありません</p>
          </div>
        )}
      </section>
    </>
  )
}
