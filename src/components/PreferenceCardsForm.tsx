'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ErrorMessage from '@/components/ui/ErrorMessage'
import {
  Wallet,
  Utensils,
  Handshake,
  MapPin,
  Coffee,
  PartyPopper,
  Sparkles,
  House,
  Beef,
  Zap,
  Armchair,
  Camera,
  UserRound,
  Users,
  Heart,
  UsersRound,
  Compass,
  MessageSquareText,
  Check,
  Tag,
  Store,
  UtensilsCrossed,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'

export type PreferenceCard = {
  id: string
  key: string
  label: string
  description: string | null
  image_path: string | null
  sort_order: number
}

type Props = {
  cards: PreferenceCard[]
  initialKeys: string[]
  mode: 'initial' | 'edit'
}

const MIN_CARDS = 5
const MAX_CARDS = 10

// Category definitions — front-end managed; no DB column needed
const CATEGORIES: { label: string; keys: string[]; Icon: LucideIcon }[] = [
  {
    label: 'お店選びで重視すること',
    keys: ['cost_conscious', 'taste_focused', 'good_service', 'easy_access'],
    Icon: Tag,
  },
  {
    label: 'お店の雰囲気',
    keys: ['quiet_atmosphere', 'lively_atmosphere', 'stylish_space', 'casual_vibe'],
    Icon: Store,
  },
  {
    label: '食事のスタイル',
    keys: ['hearty_meal', 'quick_service', 'long_stay_ok', 'photogenic_food'],
    Icon: UtensilsCrossed,
  },
  {
    label: '利用シーン・お店の選び方',
    keys: ['solo_friendly', 'friends_friendly', 'date_friendly', 'large_group_ok', 'local_discovery', 'good_reputation'],
    Icon: UserCheck,
  },
]

// Card icon config — icon + category-tinted background
type CardConfig = { Icon: LucideIcon; bg: string; iconColor: string }

const CARD_CONFIG: Record<string, CardConfig> = {
  // Category 1: お店選びで重視すること — warm amber
  cost_conscious:    { Icon: Wallet,             bg: 'bg-amber-50',   iconColor: 'text-amber-600' },
  taste_focused:     { Icon: Utensils,           bg: 'bg-amber-50',   iconColor: 'text-amber-600' },
  good_service:      { Icon: Handshake,          bg: 'bg-amber-50',   iconColor: 'text-amber-600' },
  easy_access:       { Icon: MapPin,             bg: 'bg-amber-50',   iconColor: 'text-amber-600' },
  // Category 2: お店の雰囲気 — soft sage/green
  quiet_atmosphere:  { Icon: Coffee,             bg: 'bg-green-50',   iconColor: 'text-green-700' },
  lively_atmosphere: { Icon: PartyPopper,        bg: 'bg-green-50',   iconColor: 'text-green-700' },
  stylish_space:     { Icon: Sparkles,           bg: 'bg-green-50',   iconColor: 'text-green-700' },
  casual_vibe:       { Icon: House,              bg: 'bg-green-50',   iconColor: 'text-green-700' },
  // Category 3: 食事のスタイル — soft rose/peach
  hearty_meal:       { Icon: Beef,               bg: 'bg-rose-50',    iconColor: 'text-rose-500' },
  quick_service:     { Icon: Zap,                bg: 'bg-rose-50',    iconColor: 'text-rose-500' },
  long_stay_ok:      { Icon: Armchair,           bg: 'bg-rose-50',    iconColor: 'text-rose-500' },
  photogenic_food:   { Icon: Camera,             bg: 'bg-rose-50',    iconColor: 'text-rose-500' },
  // Category 4: 利用シーン — light sky/blue
  solo_friendly:     { Icon: UserRound,          bg: 'bg-sky-50',     iconColor: 'text-sky-600' },
  friends_friendly:  { Icon: Users,              bg: 'bg-sky-50',     iconColor: 'text-sky-600' },
  date_friendly:     { Icon: Heart,              bg: 'bg-sky-50',     iconColor: 'text-sky-600' },
  large_group_ok:    { Icon: UsersRound,         bg: 'bg-sky-50',     iconColor: 'text-sky-600' },
  local_discovery:   { Icon: Compass,            bg: 'bg-sky-50',     iconColor: 'text-sky-600' },
  good_reputation:   { Icon: MessageSquareText,  bg: 'bg-sky-50',     iconColor: 'text-sky-600' },
}

const DEFAULT_CONFIG: CardConfig = { Icon: Utensils, bg: 'bg-stone-50', iconColor: 'text-stone-500' }

function CardItem({
  card,
  isSelected,
  onToggle,
}: {
  card: PreferenceCard
  isSelected: boolean
  onToggle: (key: string) => void
}) {
  const { Icon, bg, iconColor } = CARD_CONFIG[card.key] ?? DEFAULT_CONFIG

  return (
    <button
      type="button"
      onClick={() => onToggle(card.key)}
      aria-pressed={isSelected}
      className={[
        'relative flex min-h-[112px] flex-col rounded-2xl bg-surface p-3 text-left transition-all duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra',
        isSelected
          ? 'border-2 border-terra shadow-sm'
          : 'border border-edge',
      ].join(' ')}
    >
      {/* Top row: icon bubble (left) + check indicator (right) */}
      <div className="flex w-full items-start justify-between">
        {/* Icon in rounded background */}
        <span
          className={[
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            isSelected ? 'bg-terra/10' : bg,
          ].join(' ')}
          aria-hidden="true"
        >
          <Icon
            size={18}
            strokeWidth={1.75}
            className={isSelected ? 'text-terra' : iconColor}
          />
        </span>

        {/* Check indicator */}
        <span
          className={[
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-150',
            isSelected
              ? 'bg-terra'
              : 'border-2 border-edge bg-transparent',
          ].join(' ')}
          aria-hidden="true"
        >
          {isSelected && (
            <Check size={11} strokeWidth={3} className="text-white" />
          )}
        </span>
      </div>

      {/* Text area */}
      <div className="mt-2 flex flex-1 flex-col justify-end">
        <p className="text-sm font-bold leading-snug text-ink">{card.label}</p>
        {card.description && (
          <p className="mt-1 text-[11px] leading-snug text-ink-sub">{card.description}</p>
        )}
      </div>
    </button>
  )
}

export default function PreferenceCardsForm({ cards, initialKeys, mode }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [selected, setSelected] = useState<Set<string>>(new Set(initialKeys))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMaxAlert, setShowMaxAlert] = useState(false)

  function toggle(key: string) {
    if (selected.has(key)) {
      const next = new Set(selected)
      next.delete(key)
      setSelected(next)
      setShowMaxAlert(false)
    } else if (selected.size >= MAX_CARDS) {
      setShowMaxAlert(true)
    } else {
      const next = new Set(selected)
      next.add(key)
      setSelected(next)
      setShowMaxAlert(false)
    }
  }

  const count = selected.size
  const canSave = count >= MIN_CARDS
  const remaining = Math.max(0, MIN_CARDS - count)
  const progressPct = Math.min(100, (count / MIN_CARDS) * 100)
  const atMax = count >= MAX_CARDS

  async function handleSave() {
    if (!canSave || loading) return
    setLoading(true)
    setError(null)

    const { error: rpcError } = await supabase.rpc('set_my_preference_cards', {
      p_card_keys: Array.from(selected),
    })

    if (rpcError) {
      console.error('set_my_preference_cards error:', rpcError)
      setError('保存できませんでした。時間をおいてもう一度お試しください。')
      setLoading(false)
      return
    }

    if (mode === 'initial') {
      router.push('/home')
    } else {
      router.push('/mypage')
    }
  }

  const cardByKey = Object.fromEntries(cards.map((c) => [c.key, c]))
  const categorizedKeys = new Set(CATEGORIES.flatMap((cat) => cat.keys))
  const uncategorized = cards.filter((c) => !categorizedKeys.has(c.key))

  // Sticky bar: in edit mode sits above BottomNav (h-16 = 64px)
  const stickyBarClass =
    mode === 'edit'
      ? 'fixed inset-x-0 bottom-16 z-20 border-t border-edge bg-canvas/95 backdrop-blur-sm'
      : 'fixed inset-x-0 bottom-0 z-20 border-t border-edge bg-canvas/95 backdrop-blur-sm'

  return (
    <div className="pb-44">
      {/* Title + subtitle — initial mode only */}
      {mode === 'initial' && (
        <div className="px-5 pt-5 pb-4">
          <h1 className="text-[26px] font-black leading-tight text-ink">
            あなたの食の好みを
            <br />
            教えてください
          </h1>
          <p className="mt-2 text-sm leading-snug text-ink-sub">
            好きなものや、店選びで大切にしたいことを選ぼう。
            <br />
            あとから変更できます。
          </p>
        </div>
      )}

      {/* Category sections */}
      <div className="space-y-6 px-4">
        {CATEGORIES.map((cat) => {
          const catCards = cat.keys.map((k) => cardByKey[k]).filter((c): c is PreferenceCard => !!c)
          if (catCards.length === 0) return null
          const CatIcon = cat.Icon

          return (
            <section key={cat.label}>
              <div className="mb-3 flex items-center gap-2 text-terra">
                <CatIcon size={15} strokeWidth={2} aria-hidden="true" />
                <h2 className="text-sm font-bold">{cat.label}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {catCards.map((card) => (
                  <CardItem
                    key={card.key}
                    card={card}
                    isSelected={selected.has(card.key)}
                    onToggle={toggle}
                  />
                ))}
              </div>
            </section>
          )
        })}

        {/* Fallback section for cards added after this category list was written */}
        {uncategorized.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2 text-terra">
              <Tag size={15} strokeWidth={2} aria-hidden="true" />
              <h2 className="text-sm font-bold">その他</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {uncategorized.map((card) => (
                <CardItem
                  key={card.key}
                  card={card}
                  isSelected={selected.has(card.key)}
                  onToggle={toggle}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {error && (
        <div className="mt-6 px-4">
          <ErrorMessage message={error} />
        </div>
      )}

      {/* Sticky bottom bar */}
      <div className={stickyBarClass}>
        <div
          className="px-4 pt-3"
          style={{
            paddingBottom:
              mode === 'initial' ? 'max(0.75rem, env(safe-area-inset-bottom))' : '0.75rem',
          }}
        >
          {/* Max-reached alert */}
          {(atMax || showMaxAlert) && (
            <p className="mb-2 rounded-lg bg-amber-50 px-3 py-1.5 text-center text-xs font-medium text-amber-700">
              選択できるのは最大{MAX_CARDS}枚です。変更する場合は選択を解除してください。
            </p>
          )}

          {/* Row 1: status text + save button */}
          <div className="flex items-center gap-3">
            <p className="flex-1 text-sm font-medium leading-tight text-ink-sub">
              {canSave ? `${count}枚選択中` : `あと${remaining}枚選ぶと保存できます`}
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || loading}
              className="h-11 shrink-0 rounded-xl bg-terra px-5 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading
                ? '保存中...'
                : mode === 'initial'
                  ? 'FoodKitをはじめる'
                  : '変更を保存'}
            </button>
          </div>

          {/* Row 2: progress bar + counter */}
          <div className="mt-2 flex items-center gap-2">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-edge">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-terra transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-ink-sub">
              {count} / {count >= MIN_CARDS ? MAX_CARDS : MIN_CARDS}枚
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
