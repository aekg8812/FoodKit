'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'

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

export default function PreferenceCardsForm({ cards, initialKeys, mode }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [selected, setSelected] = useState<Set<string>>(new Set(initialKeys))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const count = selected.size
  const canSave = count >= MIN_CARDS

  async function handleSave() {
    if (!canSave) return
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
      router.push('/mypage/food-preferences')
    }
  }

  const ctaLabel = mode === 'initial' ? 'FoodKitをはじめる' : '変更を保存'

  return (
    <main className="min-h-screen bg-canvas pb-32">
      {/* Header */}
      <div className="px-5 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold leading-snug text-ink">
              あなたの食の好みを<br />選んでください
            </h1>
            <p className="mt-1 text-sm text-ink-sub">
              気になるカードを{MIN_CARDS}つ以上選んでください
            </p>
          </div>
          {count > 0 && (
            <div className="shrink-0 flex items-center gap-1 rounded-full bg-terra/10 px-3 py-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-xs font-semibold text-terra">{count}個選択中</span>
            </div>
          )}
        </div>
      </div>

      {/* Card grid */}
      <div className="px-5">
        <div className="grid grid-cols-2 gap-3">
          {cards.map((card) => {
            const isSelected = selected.has(card.key)
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => toggle(card.key)}
                aria-pressed={isSelected}
                className={[
                  'relative overflow-hidden rounded-2xl text-left transition-all duration-150 active:scale-[0.97]',
                  isSelected
                    ? 'ring-2 ring-terra ring-offset-1'
                    : 'ring-1 ring-edge',
                ].join(' ')}
                style={{ aspectRatio: '1 / 1' }}
              >
                {/* Background image or gradient placeholder */}
                {card.image_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.image_path}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(135deg, #FFF3E6 0%, #FFE4CC 100%)' }}
                  />
                )}

                {/* Gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Selected checkmark */}
                {isSelected && (
                  <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-terra shadow-md">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}

                {/* Text overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-sm font-bold leading-snug text-white drop-shadow-sm">{card.label}</p>
                  {card.description && (
                    <p className="mt-0.5 text-[11px] leading-snug text-white/80 line-clamp-2">
                      {card.description}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="px-5 mt-6">
          <ErrorMessage message={error} />
        </div>
      )}

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 bg-canvas/95 px-5 pb-8 pt-4 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-sm">
          <Button
            type="button"
            onClick={handleSave}
            loading={loading}
            disabled={!canSave || loading}
          >
            {loading ? '保存中...' : ctaLabel}
          </Button>
          {!canSave && (
            <p className="mt-2 text-center text-xs text-ink-sub">
              あと{MIN_CARDS - count}個選んでください
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
