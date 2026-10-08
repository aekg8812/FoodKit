'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  GROUP_BUDGET_VALUES,
  GROUP_BUDGET_LABEL,
  FOOD_VALUES,
  FOOD_TO_GENRE,
  VIBE_VALUES,
  VIBE_LABEL,
  TRANSPORT_VALUES,
  TRANSPORT_LABEL,
  TRAVEL_VALUES,
  TRAVEL_LABEL,
  serializeGroupSearchParams,
  type GroupBudgetValue,
  type GroupSearchParams,
  type FoodValue,
  type VibeValue,
  type TransportValue,
  type TravelValue,
} from '@/lib/restaurants/groupSearch'

const MEAL_VALUES = ['lunch', 'dinner'] as const
type MealValue = (typeof MEAL_VALUES)[number]
const MEAL_LABEL: Record<MealValue, string> = { lunch: 'ランチ', dinner: '夕食' }

type PrefChip = { label: string; sort_order: number }

type Props = {
  groupId: string
  memberCount: number
  prefChips: PrefChip[]
  initial: GroupSearchParams
}

function Chip({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={[
        'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
        selected
          ? 'border-terra bg-terra text-white'
          : 'border-edge bg-surface text-ink hover:border-terra hover:text-terra',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function Row({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="py-4 first:pt-0">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="text-terra">{icon}</span>
        <span className="text-sm font-bold text-ink">{title}</span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export default function GroupConditionsForm({ groupId, memberCount, prefChips, initial }: Props) {
  const router = useRouter()

  const [budget, setBudget] = useState<GroupBudgetValue | null>(initial.budget)
  const [food, setFood] = useState<FoodValue | null>(initial.food)
  const [vibe, setVibe] = useState<VibeValue | null>(initial.vibe)
  const [meal, setMeal] = useState<MealValue | null>(initial.meal)
  const [walkIn, setWalkIn] = useState(initial.walkIn)
  const [parking, setParking] = useState(initial.parking)
  const [openNow, setOpenNow] = useState(initial.openNow)
  const [transport, setTransport] = useState<TransportValue | null>(initial.transport)
  const [travel, setTravel] = useState<TravelValue | null>(initial.travel)

  function handleSubmit() {
    const params: GroupSearchParams = {
      budget,
      food,
      vibe,
      meal,
      walkIn,
      parking,
      openNow,
      transport,
      travel,
    }
    const qs = serializeGroupSearchParams(params).toString()
    router.push(`/groups/${groupId}/recommendations/results${qs ? `?${qs}` : ''}`)
  }

  // Build selected labels for summary
  const selectedLabels: string[] = []
  selectedLabels.push(`${memberCount}人`)
  if (budget !== null) selectedLabels.push(`${GROUP_BUDGET_LABEL[budget]}以下`)
  if (transport !== null && travel !== null) selectedLabels.push(`${TRANSPORT_LABEL[transport]}で${TRAVEL_LABEL[travel]}`)
  if (meal !== null) selectedLabels.push(MEAL_LABEL[meal])
  if (vibe !== null) selectedLabels.push(VIBE_LABEL[vibe])
  if (food !== null) selectedLabels.push(FOOD_TO_GENRE[food])
  if (openNow) selectedLabels.push('営業中')
  if (walkIn) selectedLabels.push('予約なしOK')
  if (parking) selectedLabels.push('駐車場あり')

  return (
    <div className="mx-auto max-w-md px-4 pt-4 space-y-4">

      {/* Group preferences section */}
      {prefChips.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-bold text-ink">このグループの好み</h2>
          <div className="flex flex-wrap gap-2">
            {prefChips.map(c => (
              <span
                key={c.sort_order}
                className="rounded-full border border-terra/30 bg-terra/10 px-3 py-1.5 text-sm font-medium text-terra"
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Today's conditions */}
      <div>
        <h2 className="text-base font-bold text-ink">今日の条件</h2>
        <p className="mt-0.5 text-xs text-ink-sub">みんなの好みと今日の条件から、お店を提案します</p>
      </div>

      <div className="divide-y divide-edge rounded-2xl border border-edge bg-surface px-4">

        {/* Party size (read-only) */}
        <Row
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          title="人数"
        >
          <span className="rounded-full bg-terra/10 px-4 py-2 text-sm font-bold text-terra">
            {memberCount}人
          </span>
          <span className="self-center text-xs text-ink-sub">※ このグループのメンバー数を使用しています</span>
        </Row>

        {/* Budget */}
        <Row
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <path d="M9 12h6" />
            </svg>
          }
          title="1人あたりの予算"
        >
          {GROUP_BUDGET_VALUES.map(v => (
            <Chip key={v} label={GROUP_BUDGET_LABEL[v]} selected={budget === v} onToggle={() => setBudget(prev => prev === v ? null : v)} />
          ))}
          <Chip label="指定なし" selected={budget === null} onToggle={() => setBudget(null)} />
        </Row>

        {/* Transport */}
        <Row
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="M16 8h4l3 3v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          }
          title="移動手段"
        >
          {TRANSPORT_VALUES.map(v => (
            <Chip
              key={v}
              label={TRANSPORT_LABEL[v]}
              selected={transport === v}
              onToggle={() => {
                const next = transport === v ? null : v
                setTransport(next)
                if (next !== null && travel === null) setTravel(10)
                if (next === null) setTravel(null)
              }}
            />
          ))}
        </Row>

        {/* Travel time — only when transport is selected */}
        {transport !== null && (
          <Row
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            title="移動時間"
          >
            {TRAVEL_VALUES.map(v => (
              <Chip key={v} label={TRAVEL_LABEL[v]} selected={travel === v} onToggle={() => setTravel(prev => prev === v ? null : v)} />
            ))}
            <Chip label="指定なし" selected={travel === null} onToggle={() => setTravel(null)} />
          </Row>
        )}

        {/* Meal period */}
        <Row
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          }
          title="時間帯"
        >
          {MEAL_VALUES.map(v => (
            <Chip key={v} label={MEAL_LABEL[v]} selected={meal === v} onToggle={() => setMeal(prev => prev === v ? null : v)} />
          ))}
          <Chip label="どちらでも" selected={meal === null} onToggle={() => setMeal(null)} />
        </Row>

        {/* Vibe */}
        <Row
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          }
          title="雰囲気"
        >
          {VIBE_VALUES.map(v => (
            <Chip key={v} label={VIBE_LABEL[v]} selected={vibe === v} onToggle={() => setVibe(prev => prev === v ? null : v)} />
          ))}
          <Chip label="どちらでも" selected={vibe === null} onToggle={() => setVibe(null)} />
        </Row>

        {/* Food type */}
        <Row
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
              <line x1="7" y1="2" x2="7" y2="11" />
              <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zM21 15v7" />
            </svg>
          }
          title="食べたいもの"
        >
          {FOOD_VALUES.map(v => (
            <Chip key={v} label={FOOD_TO_GENRE[v]} selected={food === v} onToggle={() => setFood(prev => prev === v ? null : v)} />
          ))}
          <Chip label="なんでも" selected={food === null} onToggle={() => setFood(null)} />
        </Row>

        {/* Other options */}
        <Row
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
            </svg>
          }
          title="その他"
        >
          <Chip label="営業している店だけ" selected={openNow} onToggle={() => setOpenNow(p => !p)} />
          <Chip label="予約なしで入れる店" selected={walkIn} onToggle={() => setWalkIn(p => !p)} />
          <Chip label="駐車場あり" selected={parking} onToggle={() => setParking(p => !p)} />
        </Row>

      </div>

      {/* Info banner */}
      <div className="flex items-center gap-2.5 rounded-xl bg-terra/10 px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span className="text-xs font-medium text-terra">{memberCount}人の好みも考慮しておすすめします</span>
      </div>

      {/* Selected conditions summary */}
      {selectedLabels.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold text-ink">選択中</p>
          <div className="flex flex-wrap gap-2">
            {selectedLabels.map(label => (
              <span key={label} className="rounded-full border border-edge bg-surface px-3 py-1 text-xs text-ink">
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Submit CTA */}
      <button
        type="button"
        onClick={handleSubmit}
        className="flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-xl bg-terra text-base font-bold text-white transition-opacity hover:opacity-90"
      >
        この条件でおすすめを見る
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  )
}
