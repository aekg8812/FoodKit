'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import TextareaField from '@/components/ui/TextareaField'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { RESTAURANT_GENRES } from '@/lib/restaurants/genres'
import { RESTAURANT_AREAS } from '@/lib/restaurants/areas'
import { createRestaurant } from '@/lib/restaurants/create'
import { ensureRestaurantAccesses } from '@/lib/restaurants/access'
import {
  findDuplicateRestaurantCandidates,
  type RestaurantSearchResult,
} from '@/lib/restaurants/search'

type FormStep =
  | { kind: 'form' }
  | { kind: 'duplicate_warning'; candidates: RestaurantSearchResult[] }
  | { kind: 'access_failed'; restaurantId: string }

function logError(err: unknown) {
  if (err !== null && typeof err === 'object') {
    const { message, code, details, hint } = err as Record<string, unknown>
    console.error('[RestaurantNewForm] error:', message, code, details, hint)
  } else {
    console.error('[RestaurantNewForm] error:', err)
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

type Props = {
  initialName?: string
  initialArea?: string
  initialGenre?: string
}

export default function RestaurantNewForm({
  initialName = '',
  initialArea = '',
  initialGenre = '',
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<FormStep>({ kind: 'form' })
  const [name, setName] = useState(initialName)
  const [area, setArea] = useState(initialArea)
  const [genre, setGenre] = useState(initialGenre)
  const [address, setAddress] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectingCandidateId, setSelectingCandidateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function isExactDuplicate(candidate: RestaurantSearchResult): boolean {
    const normalize = (value: string | null) => (value ?? '').trim().toLocaleLowerCase('ja')

    return (
      normalize(candidate.name) === normalize(name) &&
      normalize(candidate.area) === normalize(area) &&
      normalize(candidate.genre) === normalize(genre) &&
      normalize(candidate.address) === normalize(address)
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      const candidates = await findDuplicateRestaurantCandidates(supabase, name, area)
      if (candidates.length > 0) {
        setStep({ kind: 'duplicate_warning', candidates })
        return
      }

      await submitRestaurant()
    } catch (err) {
      logError(err)
      setError(toJapaneseError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function submitRestaurant() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Authentication is required')

    const restaurantId = await createRestaurant(
      supabase,
      { name, area, genre, address, memo },
      user.id,
    )

    try {
      await ensureRestaurantAccesses(supabase, restaurantId, user.id)
    } catch (accessError) {
      logError(accessError)
      // The restaurant remains available for an access-only retry.
      setStep({ kind: 'access_failed', restaurantId })
      setError('店舗は作成されましたが、共有設定の保存に失敗しました。もう一度お試しください')
      return
    }

    router.push(`/restaurants/${restaurantId}`)
  }

  async function handleCreateDespiteWarning() {
    setSubmitting(true)
    setError(null)

    try {
      await submitRestaurant()
    } catch (err) {
      logError(err)
      setError(toJapaneseError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRetryAccess() {
    if (step.kind !== 'access_failed') return
    const { restaurantId } = step
    setSubmitting(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Authentication is required')

      await ensureRestaurantAccesses(supabase, restaurantId, user.id)

      router.push(`/restaurants/${restaurantId}`)
    } catch (err) {
      logError(err)
      setError('共有設定の保存に失敗しました。時間をおいて再度お試しください')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSelectCandidate(restaurantId: string) {
    setSelectingCandidateId(restaurantId)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Authentication is required')

      await ensureRestaurantAccesses(supabase, restaurantId, user.id)
      router.push(`/restaurants/${restaurantId}`)
    } catch (err) {
      logError(err)
      setError('店舗を自分の記録に追加できませんでした。時間をおいて再度お試しください')
      setSelectingCandidateId(null)
    }
  }

  // ── Step 2 retry screen ───────────────────────────────────────────────────
  if (step.kind === 'access_failed') {
    return (
      <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
        <section className="mx-auto w-full max-w-md rounded-lg border border-edge bg-surface p-8 shadow-sm">
          <h1 className="mb-4 text-xl font-semibold text-ink">
            店舗の登録に問題が発生しました
          </h1>
          {error && <ErrorMessage message={error} />}
          <div className="mt-6">
            <Button
              type="button"
              onClick={handleRetryAccess}
              disabled={submitting}
            >
              {submitting ? '再試行中...' : 'アクセス情報の保存を再試行'}
            </Button>
          </div>
        </section>
        <BottomNav />
      </main>
    )
  }

  if (step.kind === 'duplicate_warning') {
    const hasExactDuplicate = step.candidates.some(isExactDuplicate)

    return (
      <main className="min-h-screen bg-canvas px-4 py-8 pb-24 sm:px-6 sm:py-10">
        <section className="mx-auto w-full max-w-md rounded-lg border border-edge bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold text-ink">
            {hasExactDuplicate
              ? '同じ情報の店舗がすでに登録されています'
              : 'もしかして、この店ですか？'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-sub">
            {hasExactDuplicate
              ? '重複を避けるため、まず既存店舗を確認してください。本当に別の店舗である場合のみ登録を続けてください。'
              : '同じ店舗がすでに登録されていないか確認してください。'}
          </p>

          <ul className="mt-5 space-y-3">
            {step.candidates.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  onClick={() => handleSelectCandidate(candidate.id)}
                  disabled={selectingCandidateId !== null || submitting}
                  className="block min-h-[44px] w-full rounded-xl border border-edge p-4 text-left transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="font-medium text-ink">{candidate.name}</p>
                  {(candidate.area || candidate.genre) && (
                    <p className="mt-1 text-sm text-ink-sub">
                      {[candidate.area, candidate.genre].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="mt-2 text-sm font-medium text-terra">
                    {selectingCandidateId === candidate.id
                      ? '記録に追加中…'
                      : 'この店舗を選ぶ →'}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {error && <div className="mt-4"><ErrorMessage message={error} /></div>}

          <div className="mt-6 space-y-3">
            <Button
              type="button"
              onClick={handleCreateDespiteWarning}
              disabled={submitting}
            >
              {submitting ? '登録中...' : '別店舗として登録を続ける'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep({ kind: 'form' })}
              disabled={submitting}
            >
              入力内容を修正する
            </Button>
          </div>
        </section>
        <BottomNav />
      </main>
    )
  }

  // ── Normal form ───────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <section className="mx-auto w-full max-w-md rounded-lg border border-edge bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-ink">店舗を登録</h1>

        <div className="mb-6 rounded-lg border border-edge bg-canvas px-4 py-3">
          <p className="text-xs font-medium text-ink-sub">保存先</p>
          <p className="mt-1 text-sm font-medium text-ink">あなたの記録</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-sub">
            登録した店舗は自分の記録として保存されます。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            id="name"
            label="店名"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：○○食堂"
          />

          <div>
            <label htmlFor="area" className="block text-sm font-medium text-ink">
              エリア
            </label>
            <select
              id="area"
              value={area}
              onChange={(event) => setArea(event.target.value)}
              className="mt-1 min-h-[48px] w-full rounded-xl border border-edge bg-surface px-3 text-base text-ink transition-colors duration-150 focus:border-terra focus:outline-none"
            >
              <option value="">選択してください（任意）</option>
              {RESTAURANT_AREAS.map((areaOption) => (
                <option key={areaOption} value={areaOption}>
                  {areaOption}
                </option>
              ))}
            </select>
          </div>

          {/* ジャンル選択式対応: 自由入力による表記揺れを抑える */}
          <div>
            <label htmlFor="genre" className="block text-sm font-medium text-ink">
              ジャンル
            </label>
            <select
              id="genre"
              value={genre}
              onChange={(event) => setGenre(event.target.value)}
              className="mt-1 min-h-[48px] w-full rounded-xl border border-edge bg-surface px-3 text-base text-ink transition-colors duration-150 focus:border-terra focus:outline-none"
            >
              <option value="">選択してください（任意）</option>
              {RESTAURANT_GENRES.map((genreOption) => (
                <option key={genreOption} value={genreOption}>
                  {genreOption}
                </option>
              ))}
            </select>
          </div>

          <InputField
            id="address"
            label="住所"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="例：東京都渋谷区..."
          />

          <TextareaField
            id="memo"
            label="メモ"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例：テラス席あり、クレカ不可"
          />

          {error && <ErrorMessage message={error} />}

          <Button
            type="submit"
            disabled={submitting || !name.trim()}
          >
            {submitting ? '登録中...' : '店舗を登録'}
          </Button>
        </form>

        <div className="mt-4">
          <Link href="/restaurants/search" className="text-sm text-ink-sub hover:text-ink">
            ← 店舗検索に戻る
          </Link>
        </div>
      </section>
      <BottomNav />
    </main>
  )
}
