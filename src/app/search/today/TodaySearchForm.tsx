'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PARTY_VALUES,
  BUDGET_VALUES,
  TRANSPORT_VALUES,
  TRAVEL_VALUES,
  VIBE_VALUES,
  FOOD_VALUES,
  PARTY_LABEL,
  BUDGET_LABEL,
  TRANSPORT_LABEL,
  TRAVEL_LABEL,
  VIBE_LABEL,
  FOOD_LABEL,
  serializeTodaySearchParams,
  getActiveConditionLabels,
  type PartyValue,
  type BudgetValue,
  type TransportValue,
  type TravelValue,
  type VibeValue,
  type FoodValue,
  type TodaySearchParams,
} from '@/lib/restaurants/todaySearch'

type TodaySearchFormProps = {
  initialValues: TodaySearchParams
}

function Chip<T extends string | number>({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string
  value: T
  selected: boolean
  onSelect: (v: T) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={[
        'rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97]',
        selected
          ? 'border-terra bg-terra text-white'
          : 'border-edge bg-surface text-ink',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function SectionIcon({ type }: { type: string }) {
  if (type === 'party') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
  if (type === 'budget') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M9 9h4.5a2 2 0 0 1 0 4H9a2 2 0 0 0 0 4h5" />
    </svg>
  )
  if (type === 'transport') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  )
  if (type === 'vibe') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 3h-3a2 2 0 0 1-2 2v3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3" />
    </svg>
  )
  if (type === 'food') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  )
  if (type === 'other') return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
  return null
}

export default function TodaySearchForm({ initialValues }: TodaySearchFormProps) {
  const router = useRouter()

  const [party, setParty] = useState<PartyValue | null>(initialValues.party)
  const [budget, setBudget] = useState<BudgetValue | null>(initialValues.budget)
  const [transport, setTransport] = useState<TransportValue | null>(initialValues.transport)
  const [travel, setTravel] = useState<TravelValue | null>(initialValues.travel)
  const [vibe, setVibe] = useState<VibeValue | null>(initialValues.vibe)
  const [food, setFood] = useState<FoodValue | null>(initialValues.food)
  const [walkIn, setWalkIn] = useState(initialValues.walkIn)
  const [parking, setParking] = useState(initialValues.parking)
  const [openNow, setOpenNow] = useState(initialValues.openNow)

  function toggleParty(v: PartyValue) { setParty(party === v ? null : v) }
  function toggleBudget(v: BudgetValue) { setBudget(budget === v ? null : v) }
  function toggleTransport(v: TransportValue) { setTransport(transport === v ? null : v) }
  function toggleTravel(v: TravelValue) { setTravel(travel === v ? null : v) }
  function toggleVibe(v: VibeValue) { setVibe(vibe === v ? null : v) }
  function toggleFood(v: FoodValue) { setFood(food === v ? null : v) }

  function handleSubmit() {
    const params = serializeTodaySearchParams({
      party, budget, transport, travel, vibe, food, walkIn, parking, openNow,
    })
    const qs = params.toString()
    router.push(`/search/today/results${qs ? `?${qs}` : ''}`)
  }

  const activeLabels = getActiveConditionLabels({
    party, budget, transport, travel, vibe, food, walkIn, parking, openNow,
  })

  return (
    <div className="pb-[140px]">
      {/* Heading */}
      <div className="px-5 pb-6 pt-4">
        <h1 className="text-[22px] font-black leading-snug text-ink">
          今日はどんなお店を探しますか？
        </h1>
        <p className="mt-1.5 text-sm text-ink-sub">
          今の条件を選ぶと、あなたに合いそうなお店を提案します
        </p>
      </div>

      <div className="space-y-7 px-5">
        {/* 誰と行く？ */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <SectionIcon type="party" />
            <h2 className="font-bold text-ink">誰と行く？</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {PARTY_VALUES.map((v) => (
              <Chip key={v} label={PARTY_LABEL[v]} value={v} selected={party === v} onSelect={toggleParty} />
            ))}
          </div>
        </div>

        {/* 1人あたりの予算 */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <SectionIcon type="budget" />
            <h2 className="font-bold text-ink">1人あたりの予算</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {BUDGET_VALUES.map((v) => (
              <Chip key={v} label={BUDGET_LABEL[v]} value={v} selected={budget === v} onSelect={toggleBudget} />
            ))}
            <Chip label="指定なし" value={0} selected={budget === null} onSelect={() => setBudget(null)} />
          </div>
        </div>

        {/* どこまで行ける？ */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <SectionIcon type="transport" />
            <h2 className="font-bold text-ink">どこまで行ける？</h2>
          </div>
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="flex items-center text-xs text-ink-sub">移動手段</span>
            {TRANSPORT_VALUES.map((v) => (
              <Chip key={v} label={TRANSPORT_LABEL[v]} value={v} selected={transport === v} onSelect={toggleTransport} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center text-xs text-ink-sub">移動時間の目安</span>
            {TRAVEL_VALUES.map((v) => (
              <Chip key={v} label={TRAVEL_LABEL[v]} value={v} selected={travel === v} onSelect={toggleTravel} />
            ))}
            <Chip label="指定なし" value={0} selected={travel === null} onSelect={() => setTravel(null)} />
          </div>
        </div>

        {/* 今日はどんな雰囲気？ */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <SectionIcon type="vibe" />
            <h2 className="font-bold text-ink">今日はどんな雰囲気？</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {VIBE_VALUES.map((v) => (
              <Chip key={v} label={VIBE_LABEL[v]} value={v} selected={vibe === v} onSelect={toggleVibe} />
            ))}
            <Chip label="どちらでも" value="" selected={vibe === null} onSelect={() => setVibe(null)} />
          </div>
        </div>

        {/* 食べたいもの */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <SectionIcon type="food" />
            <h2 className="font-bold text-ink">食べたいもの</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {FOOD_VALUES.map((v) => (
              <Chip key={v} label={FOOD_LABEL[v]} value={v} selected={food === v} onSelect={toggleFood} />
            ))}
            <Chip label="なんでも" value="" selected={food === null} onSelect={() => setFood(null)} />
          </div>
        </div>

        {/* その他の条件 */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <SectionIcon type="other" />
            <h2 className="font-bold text-ink">その他の条件</h2>
          </div>
          <div className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-surface">
            <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-4">
              <input
                type="checkbox"
                checked={openNow}
                onChange={(e) => setOpenNow(e.target.checked)}
                className="h-4 w-4 accent-terra"
              />
              <span className="text-sm text-ink">今営業している店だけ</span>
            </label>
            <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-4">
              <input
                type="checkbox"
                checked={walkIn}
                onChange={(e) => setWalkIn(e.target.checked)}
                className="h-4 w-4 accent-terra"
              />
              <span className="text-sm text-ink">予約なしで入れる店</span>
            </label>
            <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-4">
              <input
                type="checkbox"
                checked={parking}
                onChange={(e) => setParking(e.target.checked)}
                className="h-4 w-4 accent-terra"
              />
              <span className="text-sm text-ink">駐車場あり</span>
            </label>
          </div>
        </div>
      </div>

      {/* Sticky bottom: selected summary + CTA */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-canvas/95 px-5 pb-8 pt-3 backdrop-blur-sm">
        {activeLabels.length > 0 && (
          <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
            <span className="shrink-0 text-xs font-bold text-ink-sub">選択中</span>
            <div className="h-4 w-px shrink-0 bg-edge" />
            <div className="flex gap-1.5">
              {activeLabels.map((label) => (
                <span key={label} className="shrink-0 rounded-full bg-terra/10 px-2.5 py-0.5 text-xs font-medium text-terra">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          className="flex h-[52px] w-full items-center justify-center gap-1 rounded-full bg-terra text-base font-bold text-white"
        >
          この条件でおすすめを見る
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
