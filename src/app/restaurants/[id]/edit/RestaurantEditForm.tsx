'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import ErrorMessage from '@/components/ui/ErrorMessage'
import RestaurantMainImage from '@/components/RestaurantMainImage'
import { RESTAURANT_GENRES } from '@/lib/restaurants/genres'
import { RESTAURANT_AREAS } from '@/lib/restaurants/areas'

const RESTAURANT_IMAGE_BUCKET = 'restaurant-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']

type RestaurantData = {
  id: string
  name: string
  area: string | null
  genre: string | null
  address: string | null
  budget_per_person_max_yen: number | null
  party_size_tags: string[] | null
  atmosphere_tags: string[] | null
  walk_in_available: boolean | null
  parking_available: boolean | null
  main_image_path: string | null
}

type Props = {
  restaurant: RestaurantData
  currentImageSignedUrl: string | null
}

function buildImagePath(restaurantId: string, file: File): string {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  return `${restaurantId}/${crypto.randomUUID()}.${ext}`
}

export default function RestaurantEditForm({ restaurant, currentImageSignedUrl }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(restaurant.name)
  const [genre, setGenre] = useState(restaurant.genre ?? '')
  const [address, setAddress] = useState(restaurant.address ?? '')
  const [area, setArea] = useState(restaurant.area ?? '')
  const [budget, setBudget] = useState(
    restaurant.budget_per_person_max_yen != null
      ? String(restaurant.budget_per_person_max_yen)
      : '',
  )
  const [walkIn, setWalkIn] = useState(restaurant.walk_in_available ?? false)
  const [parking, setParking] = useState(restaurant.parking_available ?? false)

  // Image state
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageSignedUrl)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageAction, setImageAction] = useState<'keep' | 'replace' | 'delete'>('keep')
  const [imageError, setImageError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError(null)

    if (!ALLOWED_MIME.includes(file.type)) {
      setImageError('jpeg、png、webp の画像を選択してください')
      e.target.value = ''
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('5MB以下の画像を選択してください')
      e.target.value = ''
      return
    }

    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setImageAction('replace')
  }

  function handleDeleteImage() {
    setPreviewUrl(null)
    setImageFile(null)
    setImageAction('delete')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)

    try {
      // ── Image: replace ──────────────────────────────────────────────────
      let newImagePath: string | null | undefined = undefined // undefined = no change

      if (imageAction === 'replace' && imageFile) {
        const uploadPath = buildImagePath(restaurant.id, imageFile)
        const { error: uploadError } = await supabase.storage
          .from(RESTAURANT_IMAGE_BUCKET)
          .upload(uploadPath, imageFile, { contentType: imageFile.type })

        if (uploadError) {
          setError('写真のアップロードに失敗しました。もう一度お試しください')
          return
        }
        newImagePath = uploadPath
      }

      if (imageAction === 'delete') {
        newImagePath = null
      }

      // ── Text fields update ──────────────────────────────────────────────
      const updatePayload: Record<string, unknown> = {
        name: name.trim(),
        genre: genre.trim() || null,
        address: address.trim() || null,
        area: area.trim() || null,
        budget_per_person_max_yen: budget.trim() ? parseInt(budget.trim(), 10) : null,
        walk_in_available: walkIn,
        parking_available: parking,
      }
      if (newImagePath !== undefined) {
        updatePayload.main_image_path = newImagePath
      }

      const { error: updateError } = await supabase
        .from('restaurants')
        .update(updatePayload)
        .eq('id', restaurant.id)

      if (updateError) {
        // If we just uploaded a new image but DB failed, clean up the new upload
        if (imageAction === 'replace' && newImagePath) {
          await supabase.storage.from(RESTAURANT_IMAGE_BUCKET).remove([newImagePath as string])
        }
        setError('保存に失敗しました。時間をおいて再度お試しください')
        return
      }

      // ── After successful DB update: delete old image from Storage ────────
      if (imageAction === 'replace' && restaurant.main_image_path) {
        await supabase.storage
          .from(RESTAURANT_IMAGE_BUCKET)
          .remove([restaurant.main_image_path])
        // Failure here is acceptable — orphan object, no user-visible impact
      }

      if (imageAction === 'delete' && restaurant.main_image_path) {
        await supabase.storage
          .from(RESTAURANT_IMAGE_BUCKET)
          .remove([restaurant.main_image_path])
      }

      router.push(`/restaurants/${restaurant.id}`)
    } catch {
      setError('エラーが発生しました。時間をおいて再度お試しください')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Link
          href={`/restaurants/${restaurant.id}`}
          className="flex h-10 w-10 items-center justify-center text-ink"
          aria-label="戻る"
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
            <path d="M9 1 L1 9 L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-ink">店舗情報を編集</h1>
        <div className="w-10" />
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 px-4 pt-4 pb-8">

        {/* ── 店舗メイン写真 ─────────────────────────────────────────────── */}
        <div>
          <p className="mb-2 text-sm font-bold text-ink">店舗メイン写真</p>
          <div className="relative h-[160px] w-full overflow-hidden rounded-2xl">
            <RestaurantMainImage src={previewUrl} alt={name || '店舗写真'} />
          </div>
          {imageError && <p className="mt-1 text-xs text-red-600">{imageError}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-terra px-3 text-sm font-medium text-terra"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {previewUrl ? '写真を変更' : '写真を追加'}
            </button>
            {previewUrl && imageAction !== 'delete' && (
              <button
                type="button"
                onClick={handleDeleteImage}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-edge px-3 text-sm font-medium text-ink-sub"
              >
                写真を削除
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* ── 店名 ─────────────────────────────────────────────────────── */}
        <div>
          <label htmlFor="edit-name" className="mb-1.5 block text-sm font-bold text-ink">
            店名
            <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-terra text-white">必須</span>
          </label>
          <input
            id="edit-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-2xl border border-edge bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-terra"
          />
        </div>

        {/* ── ジャンル ──────────────────────────────────────────────────── */}
        <div>
          <p className="mb-1.5 text-sm font-bold text-ink">ジャンル</p>
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

        {/* ── 住所 ─────────────────────────────────────────────────────── */}
        <div>
          <label htmlFor="edit-address" className="mb-1.5 block text-sm font-bold text-ink">住所</label>
          <input
            id="edit-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="福岡県飯塚市本町 1-2-3"
            className="w-full rounded-2xl border border-edge bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-terra"
          />
        </div>

        {/* ── エリア ────────────────────────────────────────────────────── */}
        <div>
          <label htmlFor="edit-area" className="mb-1.5 block text-sm font-bold text-ink">エリア</label>
          <select
            id="edit-area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full rounded-2xl border border-edge bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-terra"
          >
            <option value="">未設定</option>
            {RESTAURANT_AREAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* ── 予算上限 ──────────────────────────────────────────────────── */}
        <div>
          <label htmlFor="edit-budget" className="mb-1.5 block text-sm font-bold text-ink">
            予算上限（円/人）
          </label>
          <input
            id="edit-budget"
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="例：1500"
            min={1}
            className="w-full rounded-2xl border border-edge bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-terra"
          />
        </div>

        {/* ── フラグ ────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <label className="flex items-center justify-between rounded-2xl border border-edge bg-surface px-4 py-3">
            <span className="text-sm font-medium text-ink">飛び込み可能</span>
            <button
              type="button"
              role="switch"
              aria-checked={walkIn}
              onClick={() => setWalkIn((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${walkIn ? 'bg-terra' : 'bg-edge'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${walkIn ? 'left-5' : 'left-0.5'}`}
              />
            </button>
          </label>

          <label className="flex items-center justify-between rounded-2xl border border-edge bg-surface px-4 py-3">
            <span className="text-sm font-medium text-ink">駐車場あり</span>
            <button
              type="button"
              role="switch"
              aria-checked={parking}
              onClick={() => setParking((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${parking ? 'bg-terra' : 'bg-edge'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${parking ? 'left-5' : 'left-0.5'}`}
              />
            </button>
          </label>
        </div>

        {error && <ErrorMessage message={error} />}

        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="flex h-[56px] w-full items-center justify-center rounded-xl bg-terra text-base font-bold text-white disabled:opacity-50"
        >
          {submitting ? '保存中...' : '保存する'}
        </button>
      </form>

      <BottomNav />
    </main>
  )
}
