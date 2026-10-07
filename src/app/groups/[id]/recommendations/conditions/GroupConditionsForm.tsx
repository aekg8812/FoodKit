'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BUDGET_VALUES,
  BUDGET_LABEL,
  FOOD_VALUES,
  FOOD_TO_GENRE,
  VIBE_VALUES,
  VIBE_LABEL,
  type BudgetValue,
  type FoodValue,
  type VibeValue,
} from '@/lib/restaurants/todaySearch'

const MEAL_VALUES = ['lunch', 'dinner'] as const
type MealValue = (typeof MEAL_VALUES)[number]
const MEAL_LABEL: Record<MealValue, string> = { lunch: 'ランチ', dinner: 'ディナー' }

type Props = {
  groupId: string
  memberCount: number
  partyLabel: string
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

export default function GroupConditionsForm({ groupId, memberCount, partyLabel }: Props) {
  const router = useRouter()

  const [budget, setBudget] = useState<BudgetValue | null>(null)
  const [food, setFood] = useState<FoodValue | null>(null)
  const [vibe, setVibe] = useState<VibeValue | null>(null)
  const [meal, setMeal] = useState<MealValue | null>(null)
  const [walkIn, setWalkIn] = useState(false)
  const [parking, setParking] = useState(false)
  const [openNow, setOpenNow] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number; km: number } | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  function handleGeolocate() {
    if (!navigator.geolocation) {
      setGeoError('このブラウザは位置情報に対応していません')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, km: 2 })
        setGeoLoading(false)
      },
      () => {
        setGeoError('位置情報を取得できませんでした')
        setGeoLoading(false)
      },
    )
  }

  function handleSubmit() {
    const params = new URLSearchParams()
    if (budget !== null) params.set('budget', String(budget))
    if (food) params.set('food', food)
    if (vibe) params.set('vibe', vibe)
    if (meal) params.set('meal', meal)
    if (walkIn) params.set('walk_in', '1')
    if (parking) params.set('parking', '1')
    if (openNow) params.set('open_now', '1')
    if (location) {
      params.set('lat', String(location.lat))
      params.set('lng', String(location.lng))
      params.set('km', String(location.km))
    }
    router.push(`/groups/${groupId}/recommendations/results?${params.toString()}`)
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
        {BUDGET_VALUES.map((v) => (
          <Chip
            key={v}
            label={BUDGET_LABEL[v]}
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

      {/* Distance */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">距離</h2>
        {location ? (
          <div className="flex items-center gap-3 rounded-xl border border-edge bg-canvas px-4 py-3">
            <p className="flex-1 text-sm text-ink">現在地から2km以内</p>
            <button
              type="button"
              onClick={() => setLocation(null)}
              className="text-xs text-ink-sub hover:underline"
            >
              クリア
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGeolocate}
            disabled={geoLoading}
            className="flex min-h-11 items-center gap-2 rounded-full border border-edge bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
          >
            📍 {geoLoading ? '位置情報取得中…' : '現在地を使う'}
          </button>
        )}
        {geoError && <p className="text-xs text-red-600">{geoError}</p>}
      </div>

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
