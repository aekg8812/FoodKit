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

type FormStep =
  | { kind: 'form' }
  | { kind: 'access_failed'; restaurantId: string }

function logError(err: unknown) {
  if (err !== null && typeof err === 'object') {
    const { message, code, details, hint } = err as Record<string, unknown>
    console.error('[RestaurantNewForm] error:', { message, code, details, hint })
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

export default function RestaurantNewForm() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<FormStep>({ kind: 'form' })
  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [genre, setGenre] = useState('')
  const [address, setAddress] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Authentication is required')

      // Step 1: INSERT restaurants
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: name.trim(),
          area: area.trim() || null,
          genre: genre.trim() || null,
          address: address.trim() || null,
          memo: memo.trim() || null,
          created_by: user.id,
          source: 'manual',
        })
        .select('id')
        .single()

      if (restaurantError) throw restaurantError

      const restaurantId = (restaurant as { id: string }).id

      // Step 2: INSERT restaurant_accesses（private行: 自分が記録している店として登録）
      // 23505 unique_violation はリトライ時の二重送信を意味するため正常扱い
      const { error: accessError } = await supabase
        .from('restaurant_accesses')
        .insert({
          restaurant_id: restaurantId,
          visibility: 'private',
          user_id: user.id,
          group_id: null,
          created_by: user.id,
        })

      if (accessError && accessError.code !== '23505') {
        // Step 1 succeeded, step 2 failed. Keep restaurantId for step-2-only retry.
        setStep({ kind: 'access_failed', restaurantId })
        setError('店舗は作成されましたが、アクセス情報の保存に失敗しました。もう一度お試しください')
        return
      }

      router.push(`/restaurants/${restaurantId}`)
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

      const { error: accessError } = await supabase
        .from('restaurant_accesses')
        .insert({
          restaurant_id: restaurantId,
          visibility: 'private',
          user_id: user.id,
          group_id: null,
          created_by: user.id,
        })

      if (accessError && accessError.code !== '23505') throw accessError

      router.push(`/restaurants/${restaurantId}`)
    } catch (err) {
      logError(err)
      setError(toJapaneseError(err))
    } finally {
      setSubmitting(false)
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

          <InputField
            id="area"
            label="エリア"
            type="text"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="例：渋谷"
          />

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
          <Link href="/restaurants" className="text-sm text-ink-sub hover:text-ink">
            ← 一覧に戻る
          </Link>
        </div>
      </section>
      <BottomNav />
    </main>
  )
}
