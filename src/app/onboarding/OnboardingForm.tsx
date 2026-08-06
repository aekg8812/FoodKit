'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  classifyValueType,
  VALUE_TYPE_DESCRIPTION,
  type MainValueType,
} from '@/lib/onboarding/classifyValueType'
import Button from '@/components/ui/Button'
import ErrorMessage from '@/components/ui/ErrorMessage'
import ValueTypeBadge from '@/components/ValueTypeBadge'

export type OnboardingOption = { id: string; option_text: string }
export type OnboardingQuestion = {
  id: string
  question_text: string
  value_options: OnboardingOption[]
}

interface Props {
  q1: OnboardingQuestion
  q2a: OnboardingQuestion
  q2b: OnboardingQuestion
}

type Step =
  | { kind: 'q1' }
  | { kind: 'q2'; q1OptionId: string; q1IsYes: boolean }
  | { kind: 'result'; valueType: MainValueType }

function logError(err: unknown) {
  if (err !== null && typeof err === 'object') {
    const { message, code, details, hint } = err as Record<string, unknown>
    console.error('[OnboardingForm] error:', { message, code, details, hint })
  } else {
    console.error('[OnboardingForm] error:', err)
  }
}

function toJapaneseError(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : err !== null && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : ''
  if (msg.includes('Authentication is required')) return 'ログインが必要です。再度ログインしてください'
  return 'エラーが発生しました。時間をおいて再度お試しください'
}

function StepBar({ current }: { current: 1 | 2 }) {
  return (
    <div className="mb-6 flex gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-terra" />
      <div className={`h-1.5 flex-1 rounded-full ${current >= 2 ? 'bg-terra' : 'bg-edge'}`} />
    </div>
  )
}

export default function OnboardingForm({ q1, q2a, q2b }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>({ kind: 'q1' })
  const [submittingOptionId, setSubmittingOptionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleQ1(option: OnboardingOption) {
    const q1IsYes = option.option_text === 'はい'
    setStep({ kind: 'q2', q1OptionId: option.id, q1IsYes })
    setError(null)
  }

  async function handleQ2(option: OnboardingOption) {
    if (step.kind !== 'q2') return
    setSubmittingOptionId(option.id)
    setError(null)

    const { q1OptionId, q1IsYes } = step
    const q2IsYes = option.option_text === 'はい'
    const currentQ2 = q1IsYes ? q2a : q2b
    const valueType = classifyValueType(q1IsYes, q2IsYes)
    const scores = { cost: 0, taste: 0, atmosphere: 0, hospitality: 0 }
    scores[valueType] = 1

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Authentication is required')

      // ① answers: upsert Q1 and Q2 in one call
      const { error: answersError } = await supabase
        .from('user_value_answers')
        .upsert(
          [
            { user_id: user.id, question_id: q1.id, option_id: q1OptionId },
            { user_id: user.id, question_id: currentQ2.id, option_id: option.id },
          ],
          { onConflict: 'user_id,question_id' }
        )
      if (answersError) throw answersError

      // ② user_value_profiles: write classification result
      const { error: profileError } = await supabase
        .from('user_value_profiles')
        .update({
          main_value_type: valueType,
          scores_json: scores,
          confidence: 0.4,
          profile_completion: 20,
        })
        .eq('user_id', user.id)
      if (profileError) throw profileError

      // ③ users.onboarding_completed = true — last, intentionally.
      //    If earlier steps fail, this stays false and the user can retry safely.
      const { error: userError } = await supabase
        .from('users')
        .update({ onboarding_completed: true })
        .eq('id', user.id)
      if (userError) throw userError

      // Show result here; router.refresh() is deferred to the "はじめる" button
      setStep({ kind: 'result', valueType })
    } catch (err) {
      logError(err)
      setError(toJapaneseError(err))
    } finally {
      setSubmittingOptionId(null)
    }
  }

  function handleStart() {
    router.refresh()
    router.push('/home')
  }

  // ── Result screen ────────────────────────────────────────────────────────
  if (step.kind === 'result') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
        <section className="w-full max-w-md rounded-2xl border border-edge bg-surface p-8 shadow-sm">
          <p className="mb-2 text-center text-3xl" aria-hidden="true">✨</p>
          <p className="mb-3 text-center text-sm font-medium text-ink-sub">診断結果</p>
          <div className="mb-2 text-center">
            <ValueTypeBadge type={step.valueType} />
          </div>
          <p className="mb-8 mt-3 text-center text-sm leading-relaxed text-ink-sub">
            {VALUE_TYPE_DESCRIPTION[step.valueType]}
          </p>
          <Button type="button" onClick={handleStart}>
            FoodKit をはじめる
          </Button>
        </section>
      </main>
    )
  }

  // ── Q2 screen ────────────────────────────────────────────────────────────
  if (step.kind === 'q2') {
    const currentQ2 = step.q1IsYes ? q2a : q2b
    const isSubmitting = submittingOptionId !== null

    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
        <section className="w-full max-w-md rounded-2xl border border-edge bg-surface p-8 shadow-sm">
          <StepBar current={2} />
          <p className="mb-1 text-xs font-medium text-ink-sub">質問 2 / 2</p>
          <h1 className="mb-7 text-xl font-semibold leading-snug text-ink">
            {currentQ2.question_text}
          </h1>

          {error && <ErrorMessage message={error} />}

          <div className="mt-4 space-y-3">
            {currentQ2.value_options.map((option) => (
              <Button
                key={option.id}
                type="button"
                onClick={() => handleQ2(option)}
                disabled={isSubmitting}
              >
                {submittingOptionId === option.id ? '送信中...' : option.option_text}
              </Button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setStep({ kind: 'q1' })
              setError(null)
            }}
            disabled={isSubmitting}
            className="mt-5 w-full text-center text-sm text-ink-sub transition-colors duration-150 hover:text-ink disabled:opacity-50"
          >
            ← Q1 をやり直す
          </button>
        </section>
      </main>
    )
  }

  // ── Q1 screen ─────────────────────────────────────────────────────────────
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
      <section className="w-full max-w-md rounded-2xl border border-edge bg-surface p-8 shadow-sm">
        <StepBar current={1} />
        <h1 className="mb-2 text-2xl font-bold text-ink">価値観診断</h1>
        <p className="mb-7 text-sm leading-relaxed text-ink-sub">
          2問の質問に答えて、あなたのお店選びのタイプを診断します。
        </p>

        <p className="mb-1 text-xs font-medium text-ink-sub">質問 1 / 2</p>
        <p className="mb-6 text-base font-semibold leading-snug text-ink">
          {q1.question_text}
        </p>

        <div className="space-y-3">
          {q1.value_options.map((option) => (
            <Button
              key={option.id}
              type="button"
              onClick={() => handleQ1(option)}
            >
              {option.option_text}
            </Button>
          ))}
        </div>
      </section>
    </main>
  )
}
