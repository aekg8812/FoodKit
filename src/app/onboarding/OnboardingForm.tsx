'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  PREFERENCE_CARDS,
  VALUE_TYPE_DESCRIPTION,
  VALUE_TYPE_LABEL,
  calculateConfidence,
  calculateValueScores,
  getTopValueTypes,
  type MainValueType,
  type ValueScores,
} from '@/lib/onboarding/classifyValueType'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'
import ValueTypeBadge from '@/components/ValueTypeBadge'

type Step =
  | { kind: 'cards' }
  | {
      kind: 'tieBreak'
      scores: ValueScores
      candidates: [MainValueType, MainValueType]
    }
  | { kind: 'result'; valueType: MainValueType }

function getErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error &&
          typeof error === 'object' &&
          'message' in error
        ? String(error.message)
        : ''

  if (message.includes('Authentication is required')) {
    return 'ログインが必要です。再度ログインしてください'
  }

  return 'エラーが発生しました。時間をおいて再度お試しください'
}

export default function OnboardingForm() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>({ kind: 'cards' })
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleCard(cardId: string) {
    if (isSubmitting) return

    setSelectedCardIds((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId)
      }

      if (current.length >= 5) return current

      return [...current, cardId]
    })

    setError(null)
  }

  function handleDiagnose() {
    if (selectedCardIds.length !== 5) return

    const scores = calculateValueScores(selectedCardIds)
    const topTypes = getTopValueTypes(scores)

    if (topTypes.length === 1) {
      void saveResult(topTypes[0], scores)
      return
    }

    setStep({
      kind: 'tieBreak',
      scores,
      candidates: [topTypes[0], topTypes[1]],
    })
  }

  async function saveResult(
    valueType: MainValueType,
    scores: ValueScores,
  ) {
    setIsSubmitting(true)
    setError(null)

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError

      const user = session?.user

      if (!user) {
        throw new Error('Authentication is required')
      }

      const { error: profileError } = await supabase
        .from('user_value_profiles')
        .update({
          main_value_type: valueType,
          scores_json: scores,
          confidence: calculateConfidence(scores),
          profile_completion: 100,
        })
        .eq('user_id', user.id)

      if (profileError) throw profileError

      // 完了フラグは必ず最後に更新する
      const { error: userError } = await supabase
        .from('users')
        .update({ onboarding_completed: true })
        .eq('id', user.id)

      if (userError) throw userError

      setStep({ kind: 'result', valueType })
    } catch (caughtError) {
      console.error('[OnboardingForm] error:', caughtError)
      setError(getErrorMessage(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleStart() {
    router.refresh()
    router.push('/home')
  }

  if (step.kind === 'result') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-12">
        <section className="w-full max-w-md rounded-lg border border-edge bg-surface p-7 shadow-sm">
          <p className="mb-3 text-center text-sm font-medium text-ink-sub">
            あなたの価値観タイプ
          </p>

          <div className="text-center">
            <ValueTypeBadge type={step.valueType} />
          </div>

          <p className="mb-7 mt-4 text-center text-sm leading-relaxed text-ink-sub">
            {VALUE_TYPE_DESCRIPTION[step.valueType]}
          </p>

          <Button type="button" onClick={handleStart}>
            FoodKitをはじめる
          </Button>
        </section>
      </main>
    )
  }

  if (step.kind === 'tieBreak') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-12">
        <section className="w-full max-w-md">
          <p className="mb-2 text-sm font-medium text-ink-sub">
            最後の質問
          </p>
          <h1 className="mb-2 text-2xl font-bold text-ink">
            より自分に近いのは？
          </h1>
          <p className="mb-6 text-sm text-ink-sub">
            直感で近いと感じる方を選んでください。
          </p>

          {error && <ErrorMessage message={error} />}

          <div className="space-y-3">
            {step.candidates.map((type) => (
              <button
                key={type}
                type="button"
                disabled={isSubmitting}
                onClick={() => void saveResult(type, step.scores)}
                className="w-full rounded-lg border border-edge bg-surface p-5 text-left transition-colors hover:border-terra disabled:opacity-50"
              >
                <span className="block font-semibold text-ink">
                  {VALUE_TYPE_LABEL[type]}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-ink-sub">
                  {VALUE_TYPE_DESCRIPTION[type]}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => setStep({ kind: 'cards' })}
            className="mt-5 w-full text-sm text-ink-sub hover:text-ink disabled:opacity-50"
          >
            カード選択に戻る
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-8">
      <section className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-terra">
            {selectedCardIds.length} / 5枚選択
          </p>
          <h1 className="text-2xl font-bold text-ink">
            あなたに近いものを5枚選んでください
          </h1>
        </div>

        {error && <ErrorMessage message={error} />}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PREFERENCE_CARDS.map((card) => {
            const selected = selectedCardIds.includes(card.id)
            const selectionLimitReached =
              selectedCardIds.length >= 5 && !selected

            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={selected}
                disabled={selectionLimitReached || isSubmitting}
                onClick={() => toggleCard(card.id)}
                className={`min-h-36 rounded-lg border p-4 text-left text-sm font-medium leading-relaxed transition-colors ${
                  selected
                    ? 'border-terra bg-terra/10 text-ink'
                    : 'border-edge bg-surface text-ink hover:border-terra'
                } disabled:cursor-not-allowed disabled:opacity-45`}
              >
                {card.label}
              </button>
            )
          })}
        </div>

        <div className="sticky bottom-0 mt-6 bg-canvas py-4">
          <Button
            type="button"
            disabled={selectedCardIds.length !== 5 || isSubmitting}
            onClick={handleDiagnose}
          >
            {isSubmitting ? '診断中...' : 'この5枚で診断する'}
          </Button>
        </div>
      </section>
    </main>
  )
}
