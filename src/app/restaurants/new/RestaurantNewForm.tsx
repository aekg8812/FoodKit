'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { RESTAURANT_GENRES } from '@/lib/restaurants/genres'
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
  successDestination?: 'restaurant' | 'record'
}

function RequiredBadge() {
  return (
    <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-terra text-white">
      必須
    </span>
  )
}

function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-sub/20 text-ink-sub hover:bg-ink-sub/30"
      aria-label="クリア"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <path d="M1 1l8 8M9 1 1 9" />
      </svg>
    </button>
  )
}

export default function RestaurantNewForm({
  initialName = '',
  initialArea = '',
  initialGenre = '',
  successDestination = 'restaurant',
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  function successPush(id: string) {
    router.push(successDestination === 'record' ? `/record/${id}` : `/restaurants/${id}`)
  }

  const backHref = successDestination === 'record' ? '/record' : '/restaurants/search'

  const [step, setStep] = useState<FormStep>({ kind: 'form' })
  const [name, setName] = useState(initialName)
  const [genre, setGenre] = useState(initialGenre)
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectingCandidateId, setSelectingCandidateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // area is preserved internally but not exposed in the PDF form UI
  const area = initialArea

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
      { name, area, genre, address, memo: '' },
      user.id,
    )

    try {
      await ensureRestaurantAccesses(supabase, restaurantId, user.id)
    } catch (accessError) {
      logError(accessError)
      setStep({ kind: 'access_failed', restaurantId })
      setError('店舗は作成されましたが、共有設定の保存に失敗しました。もう一度お試しください')
      return
    }

    successPush(restaurantId)
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
      successPush(restaurantId)
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
      successPush(restaurantId)
    } catch (err) {
      logError(err)
      setError('店舗を自分の記録に追加できませんでした。時間をおいて再度お試しください')
      setSelectingCandidateId(null)
    }
  }

  // ── Access failed retry ───────────────────────────────────────────────────
  if (step.kind === 'access_failed') {
    return (
      <main className="min-h-screen bg-canvas pb-24">
        <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
          <Link href={backHref} className="flex h-10 w-10 items-center justify-center text-ink" aria-label="戻る">
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
              <path d="M9 1 L1 9 L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="flex-1 text-center text-base font-bold text-ink">新しい飲食店を登録</h1>
          <div className="w-10" />
        </div>
        <div className="px-4 pt-6 space-y-4">
          <p className="font-bold text-ink">店舗の登録に問題が発生しました</p>
          {error && <ErrorMessage message={error} />}
          <button
            type="button"
            onClick={() => void handleRetryAccess()}
            disabled={submitting}
            className="flex h-[56px] w-full items-center justify-center rounded-xl bg-terra text-base font-bold text-white disabled:opacity-50"
          >
            {submitting ? '再試行中...' : 'アクセス情報の保存を再試行'}
          </button>
        </div>
        <BottomNav />
      </main>
    )
  }

  // ── Duplicate warning ─────────────────────────────────────────────────────
  if (step.kind === 'duplicate_warning') {
    const hasExactDuplicate = step.candidates.some(isExactDuplicate)

    return (
      <main className="min-h-screen bg-canvas pb-24">
        <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
          <button
            type="button"
            onClick={() => setStep({ kind: 'form' })}
            className="flex h-10 w-10 items-center justify-center text-ink"
            aria-label="戻る"
          >
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
              <path d="M9 1 L1 9 L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-base font-bold text-ink">
            {hasExactDuplicate ? '重複店舗の確認' : 'もしかして、この店ですか？'}
          </h1>
          <div className="w-10" />
        </div>
        <div className="px-4 pt-4 space-y-4">
          <p className="text-sm leading-relaxed text-ink-sub">
            {hasExactDuplicate
              ? '重複を避けるため、まず既存店舗を確認してください。本当に別の店舗である場合のみ登録を続けてください。'
              : '同じ店舗がすでに登録されていないか確認してください。'}
          </p>
          <div className="divide-y divide-edge overflow-hidden rounded-2xl bg-surface">
            {step.candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => void handleSelectCandidate(candidate.id)}
                disabled={selectingCandidateId !== null || submitting}
                className="flex w-full items-center gap-3 p-4 text-left hover:bg-canvas disabled:opacity-60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                    <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">{candidate.name}</p>
                  {(candidate.area || candidate.genre) && (
                    <p className="text-xs text-ink-sub">{[candidate.genre, candidate.area].filter(Boolean).join('・')}</p>
                  )}
                  <p className="mt-1 text-xs font-bold text-terra">
                    {selectingCandidateId === candidate.id ? '記録に追加中…' : 'この店舗を選ぶ ›'}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {error && <ErrorMessage message={error} />}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handleCreateDespiteWarning()}
              disabled={submitting}
              className="flex h-[56px] w-full items-center justify-center rounded-xl bg-terra text-base font-bold text-white disabled:opacity-50"
            >
              {submitting ? '登録中...' : '別店舗として登録を続ける'}
            </button>
            <button
              type="button"
              onClick={() => setStep({ kind: 'form' })}
              disabled={submitting}
              className="flex h-[52px] w-full items-center justify-center rounded-2xl border border-edge bg-surface text-sm font-medium text-ink disabled:opacity-50"
            >
              入力内容を修正する
            </button>
          </div>
        </div>
        <BottomNav />
      </main>
    )
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Link href={backHref} className="flex h-10 w-10 items-center justify-center text-ink" aria-label="戻る">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
            <path d="M9 1 L1 9 L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-ink">新しい飲食店を登録</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 pt-4 pb-8 space-y-5">
        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-2xl bg-[#FFF3EC] px-4 py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terra/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-ink">FoodKitにまだないお店を追加できます</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-sub">
              登録後、そのままこのお店の記録を作成します。
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          {/* 店名 */}
          <div>
            <p className="mb-1.5 text-sm font-bold text-ink">
              店名<RequiredBadge />
            </p>
            <div className="flex items-center gap-2 rounded-2xl border border-edge bg-surface px-4 py-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="炭火焼 とり善"
                required
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-sub"
                autoComplete="off"
              />
              {name && <ClearButton onClick={() => setName('')} />}
            </div>
            <p className="mt-1.5 text-xs text-ink-sub">例：炭火焼 とり善</p>
          </div>

          {/* ジャンル */}
          <div>
            <p className="mb-1.5 text-sm font-bold text-ink">
              ジャンル<RequiredBadge />
            </p>
            <div className="flex flex-wrap gap-2">
              {RESTAURANT_GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenre(genre === g ? '' : g)}
                  className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                    genre === g
                      ? 'border-terra bg-terra text-white'
                      : 'border-edge bg-surface text-ink hover:bg-canvas'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 住所 */}
          <div>
            <p className="mb-1.5 text-sm font-bold text-ink">
              住所<RequiredBadge />
            </p>
            <div className="flex items-center gap-2 rounded-2xl border border-edge bg-surface px-4 py-3">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="福岡県飯塚市本町 1-2-3"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-sub"
                autoComplete="off"
              />
              {address && <ClearButton onClick={() => setAddress('')} />}
            </div>
            <p className="mt-1.5 text-xs text-ink-sub">店舗を特定できる住所を入力してください。</p>
          </div>

          {/* 店舗写真 — visual placeholder (no DB storage for restaurant photos) */}
          <div>
            <p className="mb-1 text-sm font-bold text-ink">
              店舗写真
              <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-ink-sub/20 text-ink-sub">
                準備中
              </span>
            </p>
            <p className="mb-2 text-xs text-ink-sub">お店や料理が分かる写真を追加してください。</p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled
                className="flex h-[100px] w-[140px] shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-edge/60 text-ink-sub/50"
                aria-label="写真を追加（準備中）"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="mt-1 text-xs">写真を追加</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-sub">
              ※ 店舗の外観・内観・料理など、お店の雰囲気が分かる写真がおすすめです。
            </p>
          </div>

          {error && <ErrorMessage message={error} />}

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="flex h-[56px] w-full items-center justify-center gap-1.5 rounded-xl bg-terra text-base font-bold text-white disabled:opacity-50"
          >
            {submitting ? '登録中...' : 'このお店を登録する'}
            {!submitting && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
          </button>
        </form>
      </div>

      <BottomNav />
    </main>
  )
}
