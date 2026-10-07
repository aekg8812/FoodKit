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
const MEAL_LABEL: Record<MealValue, string> = { lunch: 'ランチ', dinner: 'ディナー' }

type Props = {
  groupId: string
  memberCount: number
  partyLabel: string
  initial: GroupSearchParams
}

type ChipProps = {
  label: string
  selected: boolean
  onToggle: () => void
}

function Chip({ label, selected, onToggle }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={[
        'min-h-[44px] rounded-full border px-5 text-sm font-medium transition-all',
        selected
          ? 'border-terra bg-terra text-white'
          : 'border-edge bg-surface text-ink hover:border-terra hover:text-terra',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export default function GroupConditionsForm({ groupId, memberCount, partyLabel, initial }: Props) {
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

  return (
    <div className="space-y-6">
      {/* Party size — read-only, computed from member count */}
      <div className="flex items-center justify-between rounded-xl border border-edge bg-canvas px-4 py-3">
        <span className="text-sm font-medium text-ink">人数</span>
        <span className="text-sm text-ink">
          {memberCount}人
          <span className="ml-2 text-xs text-ink-sub">({partyLabel})</span>
        </span>
      </div>

      {/* Budget */}
      <Section title="予算（1人あたり）">
        {GROUP_BUDGET_VALUES.map((v) => (
          <Chip
            key={v}
            label={GROUP_BUDGET_LABEL[v]}
            selected={budget === v}
            onToggle={() => setBudget((prev) => (prev === v ? null : v))}
          />
        ))}
      </Section>

      {/* Food type */}
      <Section title="ジャンル">
        {FOOD_VALUES.map((v) => (
          <Chip
            key={v}
            label={FOOD_TO_GENRE[v]}
            selected={food === v}
            onToggle={() => setFood((prev) => (prev === v ? null : v))}
          />
        ))}
      </Section>

      {/* Vibe */}
      <Section title="雰囲気">
        {VIBE_VALUES.map((v) => (
          <Chip
            key={v}
            label={VIBE_LABEL[v]}
            selected={vibe === v}
            onToggle={() => setVibe((prev) => (prev === v ? null : v))}
          />
        ))}
      </Section>

      {/* Meal period */}
      <Section title="食事タイミング">
        {MEAL_VALUES.map((v) => (
          <Chip
            key={v}
            label={MEAL_LABEL[v]}
            selected={meal === v}
            onToggle={() => setMeal((prev) => (prev === v ? null : v))}
          />
        ))}
      </Section>

      {/* Toggles */}
      <Section title="こだわり">
        <Chip label="飛び込みOK" selected={walkIn} onToggle={() => setWalkIn((p) => !p)} />
        <Chip label="駐車場あり" selected={parking} onToggle={() => setParking((p) => !p)} />
        <Chip label="今開いている" selected={openNow} onToggle={() => setOpenNow((p) => !p)} />
      </Section>

      {/* Transport (triggers geolocation on results page) */}
      <Section title="移動手段">
        {TRANSPORT_VALUES.map((v) => (
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
      </Section>

      {transport !== null && (
        <Section title="移動時間">
          {TRAVEL_VALUES.map((v) => (
            <Chip
              key={v}
              label={TRAVEL_LABEL[v]}
              selected={travel === v}
              onToggle={() => setTravel((prev) => (prev === v ? null : v))}
            />
          ))}
        </Section>
      )}

      {transport !== null && travel !== null && (
        <p className="text-xs text-ink-sub">結果画面で現在地を取得します</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        className="flex min-h-11 w-full items-center justify-center rounded-full bg-terra text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        この条件でおすすめを探す
      </button>
    </div>
  )
}
