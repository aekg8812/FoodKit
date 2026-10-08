'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

  return (
    <main className="min-h-screen bg-canvas pb-32">
      {/* Header */}
      {mode === 'initial' ? (
        <>
          <div className="flex items-center justify-between px-5 pt-14 pb-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-10 w-10 items-center justify-center text-ink"
              aria-label="戻る"
            >
              <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
                <path d="M9 1 L1 9 L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-sm font-medium text-ink">プロフィール設定　2 / 2</span>
            <div className="w-10" />
          </div>
          {/* Progress bar */}
          <div className="h-[3px] w-full bg-terra" />
        </>
      ) : (
        <div className="flex items-center justify-between px-5 pt-14 pb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-10 w-10 items-center justify-center text-ink"
            aria-label="戻る"
          >
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
              <path d="M9 1 L1 9 L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-ink">好みを編集</h1>
          <div className="w-10" />
        </div>
      )}

      {/* Headline + subtitle */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-[26px] font-black leading-tight text-ink">
            {mode === 'initial' ? (
              <>
                あなたの食の好みを
                <br />
                教えてください
              </>
            ) : (
              'あなたの食の好みを選んでください'
            )}
          </h1>
          {/* Counter chip — inline right in edit mode */}
          {mode === 'edit' && count > 0 && (
            <div className="mt-1 shrink-0 inline-flex items-center gap-1 rounded-full bg-terra/10 px-2.5 py-1">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#F97316"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-xs font-bold text-terra">{count}個選択中</span>
            </div>
          )}
        </div>
        <p className="mt-2 text-sm leading-snug text-ink-sub">
          気になるカードを５つ以上選んでください。
          <br />
          あとからいつでも変更できます。
        </p>

        {/* Counter chip below subtitle in initial mode */}
        {mode === 'initial' && count > 0 && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-terra/10 px-3 py-1.5">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F97316"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-xs font-bold text-terra">{count}個選択しました</span>
          </div>
        )}
      </div>

      {/* Card grid — image-top + text-below layout */}
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
                  'relative overflow-hidden rounded-2xl bg-surface text-left transition-all duration-150 active:scale-[0.97]',
                  isSelected ? 'border-2 border-terra' : 'border border-edge',
                ].join(' ')}
              >
                {/* Food photo — top half */}
                <div className="relative h-28 w-full overflow-hidden">
                  {card.image_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.image_path}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-edge" />
                  )}

                  {/* Checkmark or circle indicator — top-right of photo */}
                  <span
                    className={[
                      'absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full',
                      isSelected ? 'bg-terra' : 'border-2 border-white/80 bg-black/20',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {isSelected && (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                </div>

                {/* Text section — below photo */}
                <div className="p-2.5">
                  <p className="text-sm font-bold leading-snug text-ink">{card.label}</p>
                  {card.description && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-sub">
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
        <div className="mt-6 px-5">
          <ErrorMessage message={error} />
        </div>
      )}

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 bg-canvas/95 px-5 pb-8 pt-4 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-sm">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || loading}
            className="flex h-[52px] w-full items-center justify-center gap-1 rounded-xl bg-terra text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              '保存中...'
            ) : mode === 'initial' ? (
              'FoodKitをはじめる'
            ) : (
              <>
                変更を保存
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                  <path d="M1 1l6 6-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
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
