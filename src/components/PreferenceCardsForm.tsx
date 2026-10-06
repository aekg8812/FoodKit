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

function CardPlaceholderIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-ink-sub"
    >
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  )
}

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
      router.push('/mypage')
    }
  }

  const ctaLabel = mode === 'initial' ? 'FoodKitをはじめる' : '保存する'

  return (
    <main className="min-h-screen bg-canvas px-6 pt-8 pb-32">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-bold leading-snug text-ink">
          あなたの食の好みを<br />教えてください
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-sub">
          気になるカードを{MIN_CARDS}つ以上選んでください。あとからいつでも変更できます。
        </p>

        <p className="mt-4 text-sm font-medium text-terra" aria-live="polite">
          {count > 0 ? `${count}個選択しました` : `${MIN_CARDS}個以上選んでください`}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {cards.map((card) => {
            const isSelected = selected.has(card.key)
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => toggle(card.key)}
                aria-pressed={isSelected}
                className={[
                  'relative rounded-2xl border-2 p-4 text-left transition-all duration-150',
                  'motion-safe:active:scale-[0.97]',
                  isSelected
                    ? 'border-terra bg-cream'
                    : 'border-edge bg-surface hover:border-terra/50',
                ].join(' ')}
              >
                {isSelected && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-terra">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
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

                {card.image_path ? (
                  <div className="mb-3 h-16 w-full overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.image_path}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="mb-3 flex h-16 w-full items-center justify-center rounded-lg bg-canvas">
                    <CardPlaceholderIcon />
                  </div>
                )}

                <p className="text-sm font-semibold leading-snug text-ink">{card.label}</p>
                {card.description && (
                  <p className="mt-1 text-xs leading-relaxed text-ink-sub">{card.description}</p>
                )}
              </button>
            )
          })}
        </div>

        {error && (
          <div className="mt-6">
            <ErrorMessage message={error} />
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 bg-canvas/95 px-6 pb-8 pt-4 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-md">
          <Button
            type="button"
            onClick={handleSave}
            loading={loading}
            disabled={!canSave || loading}
          >
            {loading ? '保存中...' : ctaLabel}
          </Button>
        </div>
      </div>
    </main>
  )
}
