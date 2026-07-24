'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  classifyValueType,
  VALUE_TYPE_LABEL,
  VALUE_TYPE_DESCRIPTION,
  type MainValueType,
} from '@/lib/onboarding/classifyValueType'

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
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16">
        <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="mb-1 text-sm font-medium text-zinc-500">診断結果</p>
          <h1 className="mb-2 text-2xl font-semibold text-zinc-950">
            あなたは{VALUE_TYPE_LABEL[step.valueType]}タイプです
          </h1>
          <p className="mb-8 text-sm text-zinc-600">{VALUE_TYPE_DESCRIPTION[step.valueType]}</p>
          <button
            onClick={handleStart}
            className="w-full rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            はじめる
          </button>
        </section>
      </main>
    )
  }

  // ── Q2 screen ────────────────────────────────────────────────────────────
  if (step.kind === 'q2') {
    const currentQ2 = step.q1IsYes ? q2a : q2b
    const isSubmitting = submittingOptionId !== null

    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16">
        <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="mb-1 text-xs text-zinc-400">質問 2 / 2</p>
          <h1 className="mb-6 text-xl font-semibold leading-snug text-zinc-950">
            {currentQ2.question_text}
          </h1>

          {error && (
            <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          <div className="space-y-3">
            {currentQ2.value_options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleQ2(option)}
                disabled={isSubmitting}
                className="w-full rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {submittingOptionId === option.id ? '送信中...' : option.option_text}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setStep({ kind: 'q1' })
              setError(null)
            }}
            disabled={isSubmitting}
            className="mt-4 w-full text-center text-sm text-zinc-500 hover:text-zinc-700 disabled:opacity-50"
          >
            ← Q1 をやり直す
          </button>
        </section>
      </main>
    )
  }

  // ── Q1 screen ─────────────────────────────────────────────────────────────
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold text-zinc-950">価値観診断</h1>
        <p className="mb-6 text-sm text-zinc-600">
          2問の質問に答えて、あなたのお店選びのタイプを診断します。
        </p>

        <p className="mb-1 text-xs text-zinc-400">質問 1 / 2</p>
        <p className="mb-6 text-base font-medium leading-snug text-zinc-950">
          {q1.question_text}
        </p>

        <div className="space-y-3">
          {q1.value_options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleQ1(option)}
              className="w-full rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              {option.option_text}
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
