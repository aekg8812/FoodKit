'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import {
  PARTY_VALUES,
  BUDGET_VALUES,
  VIBE_VALUES,
  FOOD_VALUES,
  PARTY_LABEL,
  BUDGET_LABEL,
  VIBE_LABEL,
  FOOD_LABEL,
  serializeTodaySearchParams,
  type PartyValue,
  type BudgetValue,
  type VibeValue,
  type FoodValue,
  type TodaySearchParams,
} from '@/lib/restaurants/todaySearch'

type TodaySearchFormProps = {
  initialValues: TodaySearchParams
}

type ChipProps<T extends string | number> = {
  label: string
  value: T
  selected: boolean
  onSelect: (v: T) => void
}

function Chip<T extends string | number>({ label, value, selected, onSelect }: ChipProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={[
        'min-h-[44px] rounded-full border px-5 text-sm font-medium transition-all duration-150',
        'motion-safe:active:scale-[0.97]',
        selected
          ? 'border-terra bg-terra text-white'
          : 'border-edge bg-surface text-ink hover:border-terra hover:text-terra',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

type SectionProps = {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export default function TodaySearchForm({ initialValues }: TodaySearchFormProps) {
  const router = useRouter()

  const [party, setParty] = useState<PartyValue | null>(initialValues.party)
  const [budget, setBudget] = useState<BudgetValue | null>(initialValues.budget)
  const [vibe, setVibe] = useState<VibeValue | null>(initialValues.vibe)
  const [food, setFood] = useState<FoodValue | null>(initialValues.food)
  const [walkIn, setWalkIn] = useState(initialValues.walkIn)
  const [parking, setParking] = useState(initialValues.parking)

  function toggleParty(v: PartyValue) {
    setParty(party === v ? null : v)
  }
  function toggleBudget(v: BudgetValue) {
    setBudget(budget === v ? null : v)
  }
  function toggleVibe(v: VibeValue) {
    setVibe(vibe === v ? null : v)
  }
  function toggleFood(v: FoodValue) {
    setFood(food === v ? null : v)
  }

  function handleSubmit() {
    const params = serializeTodaySearchParams({ party, budget, vibe, food, walkIn, parking })
    const qs = params.toString()
    router.push(`/search/today/results${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="space-y-8">
      <Section title="誰と行く？">
        {PARTY_VALUES.map((v) => (
          <Chip key={v} label={PARTY_LABEL[v]} value={v} selected={party === v} onSelect={toggleParty} />
        ))}
      </Section>

      <Section title="1人あたりの予算">
        {BUDGET_VALUES.map((v) => (
          <Chip key={v} label={BUDGET_LABEL[v]} value={v} selected={budget === v} onSelect={toggleBudget} />
        ))}
        <Chip label="指定なし" value={0} selected={budget === null} onSelect={() => setBudget(null)} />
      </Section>

      <Section title="今日はどんな雰囲気？">
        {VIBE_VALUES.map((v) => (
          <Chip key={v} label={VIBE_LABEL[v]} value={v} selected={vibe === v} onSelect={toggleVibe} />
        ))}
        <Chip label="どちらでも" value="" selected={vibe === null} onSelect={() => setVibe(null)} />
      </Section>

      <Section title="食べたいもの">
        {FOOD_VALUES.map((v) => (
          <Chip key={v} label={FOOD_LABEL[v]} value={v} selected={food === v} onSelect={toggleFood} />
        ))}
        <Chip label="なんでも" value="" selected={food === null} onSelect={() => setFood(null)} />
      </Section>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">その他の条件</h2>
        <div className="space-y-3">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl border border-edge bg-surface px-4">
            <input
              type="checkbox"
              checked={walkIn}
              onChange={(e) => setWalkIn(e.target.checked)}
              className="h-4 w-4 accent-terra"
            />
            <span className="text-sm text-ink">予約なしで入れる店</span>
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-2xl border border-edge bg-surface px-4">
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

      <Button type="button" onClick={handleSubmit}>
        この条件でおすすめを見る
      </Button>
    </div>
  )
}
