'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

interface Props {
  groupId: string
}

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

export default function RestaurantNewForm({ groupId }: Props) {
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

      // Step 2: INSERT restaurant_accesses
      // visibility='group' requires group_id IS NOT NULL AND user_id IS NULL (CHECK constraint).
      const { error: accessError } = await supabase
        .from('restaurant_accesses')
        .insert({
          restaurant_id: restaurantId,
          visibility: 'group',
          group_id: groupId,
          user_id: null,
          created_by: user.id,
        })

      if (accessError) {
        // Step 1 succeeded, step 2 failed. Keep restaurantId for step-2-only retry.
        setStep({ kind: 'access_failed', restaurantId })
        setError('店舗は作成されましたが、グループへの共有に失敗しました。もう一度お試しください')
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
          visibility: 'group',
          group_id: groupId,
          user_id: null,
          created_by: user.id,
        })

      if (accessError) throw accessError

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
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16">
        <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="mb-4 text-xl font-semibold text-zinc-950">
            店舗の登録に問題が発生しました
          </h1>
          {error && (
            <p className="mb-6 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}
          <button
            onClick={handleRetryAccess}
            disabled={submitting}
            className="w-full rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {submitting ? '再試行中...' : 'グループへの共有を再試行'}
          </button>
        </section>
      </main>
    )
  }

  // ── Normal form ───────────────────────────────────────────────────────────
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-950">店舗を登録</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
              店名 <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
              placeholder="例：○○食堂"
            />
          </div>

          <div>
            <label htmlFor="area" className="block text-sm font-medium text-zinc-700">
              エリア
            </label>
            <input
              id="area"
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
              placeholder="例：渋谷"
            />
          </div>

          <div>
            <label htmlFor="genre" className="block text-sm font-medium text-zinc-700">
              ジャンル
            </label>
            <input
              id="genre"
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
              placeholder="例：ラーメン"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-zinc-700">
              住所
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
              placeholder="例：東京都渋谷区..."
            />
          </div>

          <div>
            <label htmlFor="memo" className="block text-sm font-medium text-zinc-700">
              メモ
            </label>
            <textarea
              id="memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
              placeholder="例：テラス席あり、クレカ不可"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
          >
            {submitting ? '登録中...' : '登録する'}
          </button>
        </form>

        <div className="mt-4">
          <Link href="/restaurants" className="text-sm text-zinc-500 hover:text-zinc-700">
            ← 一覧に戻る
          </Link>
        </div>
      </section>
    </main>
  )
}
