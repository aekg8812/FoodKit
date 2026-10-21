'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import ReasonTagSelector from '@/components/review/ReasonTagSelector'
import RestaurantLabelSelector from '@/components/review/RestaurantLabelSelector'

export type ExistingReview = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  image_path: string | null
  image_url: string | null
  reason_keys?: string[]
  label_keys?: string[]
}

type Restaurant = {
  id: string
  name: string
  area: string | null
  genre: string | null
  address: string | null
}

type Props = {
  restaurantId: string
  restaurant: Restaurant
  existingReview: ExistingReview | null
}

const RATING_OPTIONS: { value: number; label: string; sub: string }[] = [
  { value: 4, label: '常連になりたい', sub: 'また何度も行きたい' },
  { value: 3, label: 'また行きたい', sub: '機会があればもう一度行きたい' },
  { value: 2, label: '一度で十分', sub: '悪くないけれど、自分からは行かない' },
  { value: 1, label: '二度と行かない', sub: 'もう一度行きたいとは思わない' },
]

const REVIEW_IMAGE_BUCKET = 'review-images'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_COMMENT = 200

function getLocalToday(): string {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatVisitDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}年${m}月${day}日`
}

function buildImagePath(userId: string, reviewId: string, file: File): string {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  return `${userId}/${reviewId}/${crypto.randomUUID()}.${ext}`
}

function logError(err: unknown) {
  if (err !== null && typeof err === 'object') {
    const { message, code, details, hint } = err as Record<string, unknown>
    console.error('[RecordFormClient] error:', message, code, details, hint)
  } else {
    console.error('[RecordFormClient] error:', err)
  }
}

export default function RecordFormClient({ restaurantId, restaurant, existingReview }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const today = getLocalToday()

  const [rating, setRating] = useState<number | null>(existingReview?.rating ?? null)
  const [reasonKeys, setReasonKeys] = useState<string[]>(existingReview?.reason_keys ?? [])
  const [labelKeys, setLabelKeys] = useState<string[]>(existingReview?.label_keys ?? [])
  const [comment, setComment] = useState(existingReview?.comment ?? '')
  const [visitDate, setVisitDate] = useState(existingReview?.visit_date ?? today)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [removeExistingImage, setRemoveExistingImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const prevPolarityRef = useRef<'positive' | 'negative' | null>(
    rating !== null ? (rating >= 3 ? 'positive' : 'negative') : null
  )

  function handleRatingChange(newRating: number) {
    const newPolarity = newRating >= 3 ? 'positive' : 'negative'
    if (prevPolarityRef.current !== null && prevPolarityRef.current !== newPolarity) {
      setReasonKeys([])
    }
    prevPolarityRef.current = newPolarity
    setRating(newRating)
  }

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  const displayedImageUrl =
    imagePreviewUrl ?? (!removeExistingImage ? existingReview?.image_url ?? null : null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('JPEG・PNG・WebP形式の画像を選んでください')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('画像は5MB以下にしてください')
      return
    }
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
    setRemoveExistingImage(false)
    setError(null)
  }

  function removeImage() {
    setImageFile(null)
    setImagePreviewUrl(null)
    setRemoveExistingImage(true)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === null) return
    if (visitDate && visitDate > today) {
      setError('未来の日付は選択できません')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Authentication is required')

      const payload = {
        rating,
        comment: comment.trim() || null,
        visit_date: visitDate || null,
      }

      if (existingReview) {
        let nextImagePath = removeExistingImage ? null : existingReview.image_path
        let uploadedImagePath: string | null = null

        if (imageFile) {
          uploadedImagePath = buildImagePath(user.id, existingReview.id, imageFile)
          const { error: uploadError } = await supabase.storage
            .from(REVIEW_IMAGE_BUCKET)
            .upload(uploadedImagePath, imageFile, { contentType: imageFile.type })
          if (uploadError) throw uploadError
          nextImagePath = uploadedImagePath
        }

        const { error: updateError } = await supabase
          .from('reviews')
          .update({ ...payload, image_path: nextImagePath })
          .eq('id', existingReview.id)
        if (updateError) {
          if (uploadedImagePath) {
            await supabase.storage.from(REVIEW_IMAGE_BUCKET).remove([uploadedImagePath])
          }
          throw updateError
        }

        if (existingReview.image_path && existingReview.image_path !== nextImagePath) {
          await supabase.storage.from(REVIEW_IMAGE_BUCKET).remove([existingReview.image_path])
        }

        const { error: signalsError } = await supabase.rpc('replace_review_learning_signals', {
          p_review_id:   existingReview.id,
          p_reason_keys: reasonKeys,
          p_label_keys:  labelKeys,
        })
        if (signalsError) throw signalsError
      } else {
        const { data: insertedReview, error: insertError } = await supabase
          .from('reviews')
          .insert({
            ...payload,
            restaurant_id: restaurantId,
            user_id: user.id,
            group_id: null,
            visibility: 'private',
          })
          .select('id')
          .single()

        if (insertError) {
          if (insertError.code === '23505') {
            window.location.reload()
            return
          }
          throw insertError
        }

        if (imageFile) {
          const imagePath = buildImagePath(user.id, insertedReview.id, imageFile)
          const { error: uploadError } = await supabase.storage
            .from(REVIEW_IMAGE_BUCKET)
            .upload(imagePath, imageFile, { contentType: imageFile.type })

          if (uploadError) {
            await supabase.from('reviews').delete().eq('id', insertedReview.id)
            throw uploadError
          }

          const { error: imageUpdateError } = await supabase
            .from('reviews')
            .update({ image_path: imagePath })
            .eq('id', insertedReview.id)

          if (imageUpdateError) {
            await supabase.storage.from(REVIEW_IMAGE_BUCKET).remove([imagePath])
            await supabase.from('reviews').delete().eq('id', insertedReview.id)
            throw imageUpdateError
          }
        }

        const { error: signalsError } = await supabase.rpc('replace_review_learning_signals', {
          p_review_id:   insertedReview.id,
          p_reason_keys: reasonKeys,
          p_label_keys:  labelKeys,
        })
        if (signalsError) throw signalsError
      }

      router.push(`/restaurants/${restaurantId}`)
    } catch (err) {
      logError(err)
      setError('エラーが発生しました。時間をおいて再度お試しください')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Link
          href="/record"
          className="flex h-10 w-10 items-center justify-center text-ink"
          aria-label="閉じる"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-ink">記録する</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 space-y-5 px-4 py-4 pb-8">
        {/* Restaurant card */}
        <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-edge bg-surface p-3">
          <div className="flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{restaurant.name}</p>
            {(restaurant.genre || restaurant.area) && (
              <p className="text-xs text-ink-sub">
                {[restaurant.genre, restaurant.area].filter(Boolean).join('・')}
              </p>
            )}
            {restaurant.address && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-sub">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z" />
                </svg>
                {restaurant.address}
              </p>
            )}
          </div>
          <Link href="/record" className="shrink-0 text-sm font-bold text-terra">
            変更 ›
          </Link>
        </div>

        {/* Rating */}
        <div>
          <h2 className="text-base font-black text-ink">このお店に、もう一度行きたいですか？</h2>
          <p className="mt-1 text-xs text-ink-sub">あなたの次の行動に近いものを選んでください</p>
          <div className="mt-3 space-y-2">
            {RATING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleRatingChange(opt.value)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                  rating === opt.value
                    ? 'border-terra bg-[#FFF3EC]'
                    : 'border-edge bg-surface hover:bg-canvas'
                }`}
              >
                {/* Radio circle */}
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  rating === opt.value ? 'border-terra' : 'border-edge'
                }`}>
                  {rating === opt.value && (
                    <div className="h-2.5 w-2.5 rounded-full bg-terra" />
                  )}
                </div>
                <div>
                  <p className={`font-bold ${rating === opt.value ? 'text-terra' : 'text-ink'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-ink-sub">{opt.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Reason tags — shown only when rating is selected */}
        {rating !== null && (
          <ReasonTagSelector
            rating={rating}
            selected={reasonKeys}
            onChange={setReasonKeys}
            disabled={submitting}
          />
        )}

        {/* Restaurant labels */}
        <RestaurantLabelSelector
          selected={labelKeys}
          onChange={setLabelKeys}
          disabled={submitting}
        />

        {/* Comment */}
        <div>
          <h2 className="mb-2 text-base font-black text-ink">ひとこと残す</h2>
          <div className="relative">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
              placeholder="感想を残しましょう（任意）"
              rows={4}
              className="w-full resize-none rounded-2xl border border-edge bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-sub focus:border-terra"
            />
            <span className="absolute bottom-3 right-4 text-xs text-ink-sub">
              {comment.length} / {MAX_COMMENT}
            </span>
          </div>
        </div>

        {/* Photo */}
        <div>
          <h2 className="mb-2 text-base font-black text-ink">写真</h2>
          <div className="flex gap-3">
            {displayedImageUrl && (
              <div className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl">
                <Image
                  src={displayedImageUrl}
                  alt="記録の写真"
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={submitting}
                  aria-label="写真を外す"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
                >
                  ×
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="flex h-[80px] w-[80px] shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-edge text-ink-sub hover:border-terra hover:text-terra"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="mt-1 text-xs">写真を追加</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={submitting}
            onChange={handleImageChange}
            className="sr-only"
          />
        </div>

        {/* Visit date */}
        <div className="flex items-center justify-between border-b border-edge py-3">
          <span className="font-black text-ink">訪問日</span>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <span>{visitDate ? formatVisitDate(visitDate) : '未設定'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="text-terra" aria-hidden="true">
              <path d="M1 1l6 6-6 6" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              type="date"
              value={visitDate}
              max={today}
              onChange={(e) => setVisitDate(e.target.value)}
              className="sr-only"
            />
          </label>
        </div>

        {/* Visibility notice */}
        <div className="border-b border-edge py-3">
          <p className="text-xs text-ink-sub">
            投稿したレビューと写真は、FoodKitに登録しているすべてのユーザーに公開されます。現在、公開範囲は変更できません。
          </p>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || rating === null}
          className="flex h-[56px] w-full items-center justify-center rounded-xl bg-terra text-base font-bold text-white disabled:opacity-50"
        >
          {submitting ? '記録中...' : '記録する'}
        </button>
      </div>
    </form>
  )
}
