'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import ReasonTagSelector from '@/components/review/ReasonTagSelector'
import RestaurantLabelSelector from '@/components/review/RestaurantLabelSelector'
import { RATING_BG, RATING_TEXT, RATING_ACCENT_BORDER, RATING_ACCENT_DOT } from '@/lib/rating/colors'
import { compressImageIfNeeded, ImageFormatError, ImageTooLargeError } from '@/lib/image/compress'

export type VisitForEdit = {
  id: string
  restaurant_id: string
  visit_date: string | null
  rating: number
  comment: string | null
  image_path: string | null
  image_url: string | null
  reason_keys: string[]
  label_keys: string[]
}

type Props = {
  visit: VisitForEdit
  restaurantName: string
}

const RATING_OPTIONS: { value: number; label: string; sub: string }[] = [
  { value: 4, label: '常連になりたい', sub: 'また何度も行きたい' },
  { value: 3, label: 'また行きたい', sub: '機会があればもう一度行きたい' },
  { value: 2, label: '一度で十分', sub: '悪くないけれど、自分からは行かない' },
  { value: 1, label: '二度と行かない', sub: 'もう一度行きたいとは思わない' },
]

const REVIEW_IMAGE_BUCKET = 'review-images'
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
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function buildVisitImagePath(userId: string, file: File): string {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  return `${userId}/visits/${crypto.randomUUID()}.${ext}`
}

async function safeDeleteImage(
  supabase: ReturnType<typeof import('@/lib/supabase/client').createClient>,
  path: string,
) {
  const [{ count: visitRefs }, { count: reviewRefs }] = await Promise.all([
    supabase.from('restaurant_visits').select('id', { count: 'exact', head: true }).eq('image_path', path),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('image_path', path),
  ])
  if ((visitRefs ?? 1) === 0 && (reviewRefs ?? 1) === 0) {
    await supabase.storage.from(REVIEW_IMAGE_BUCKET).remove([path]).catch(() => {})
  }
}

export default function VisitEditForm({ visit, restaurantName }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const today = getLocalToday()

  const [rating, setRating] = useState<number>(visit.rating)
  const [reasonKeys, setReasonKeys] = useState<string[]>(visit.reason_keys)
  const [labelKeys, setLabelKeys] = useState<string[]>(visit.label_keys)
  const [comment, setComment] = useState(visit.comment ?? '')
  const [visitDate, setVisitDate] = useState(visit.visit_date ?? today)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [removeExistingImage, setRemoveExistingImage] = useState(false)
  const [imageCompressing, setImageCompressing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const prevPolarityRef = useRef<'positive' | 'negative'>( visit.rating >= 3 ? 'positive' : 'negative')
  const compressionTokenRef = useRef(0)

  function handleRatingChange(newRating: number) {
    const newPolarity = newRating >= 3 ? 'positive' : 'negative'
    if (prevPolarityRef.current !== newPolarity) {
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
    imagePreviewUrl ?? (!removeExistingImage ? visit.image_url ?? null : null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('JPEG・PNG・WebP形式の画像を選んでください')
      return
    }

    const token = ++compressionTokenRef.current
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(null)
    setImagePreviewUrl(null)
    setError(null)
    setImageCompressing(true)

    compressImageIfNeeded(file).then((compressed) => {
      if (compressionTokenRef.current !== token) return
      setImageFile(compressed)
      setImagePreviewUrl(URL.createObjectURL(compressed))
      setRemoveExistingImage(false)
      setImageCompressing(false)
    }).catch((err: unknown) => {
      if (compressionTokenRef.current !== token) return
      const msg = err instanceof ImageFormatError || err instanceof ImageTooLargeError
        ? (err as Error).message
        : '画像の処理に失敗しました'
      setError(msg)
      setImageFile(null)
      setImageCompressing(false)
    })
  }

  function removeImage() {
    compressionTokenRef.current++
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(null)
    setImagePreviewUrl(null)
    setRemoveExistingImage(true)
    setError(null)
    setImageCompressing(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!visitDate) {
      setError('訪問日を選択してください')
      return
    }
    if (visitDate > today) {
      setError('未来の日付は選択できません')
      return
    }
    setSubmitting(true)
    setError(null)

    let uploadedImagePath: string | null = null

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Authentication is required')

      // Determine new image path
      let nextImagePath: string | null = removeExistingImage ? null : (visit.image_path ?? null)

      if (imageFile) {
        uploadedImagePath = buildVisitImagePath(user.id, imageFile)
        const { error: uploadError } = await supabase.storage
          .from(REVIEW_IMAGE_BUCKET)
          .upload(uploadedImagePath, imageFile, { contentType: imageFile.type })
        if (uploadError) throw uploadError
        nextImagePath = uploadedImagePath
      }

      type UpsertVisitResult = {
        visit_id: string
        review_id: string
        is_representative: boolean
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc('upsert_visit', {
        p_restaurant_id: visit.restaurant_id,
        p_visit_id:      visit.id,
        p_rating:        rating,
        p_visit_date:    visitDate,
        p_comment:       comment.trim() || null,
        p_image_path:    nextImagePath,
        p_reason_keys:   reasonKeys,
        p_label_keys:    labelKeys,
      })

      if (rpcError) {
        // Don't delete uploadedImagePath — RPC may have succeeded with lost response
        throw rpcError
      }

      const result = rpcData as UpsertVisitResult

      // Safe image cleanup: delete old image only if no longer referenced
      const oldImagePath = visit.image_path
      if (oldImagePath && oldImagePath !== nextImagePath) {
        await safeDeleteImage(supabase, oldImagePath)
      }

      router.push(`/visits/${result.visit_id}`)
    } catch (err) {
      const e = err as { message?: string }
      console.error('[VisitEditForm]', e?.message, err)
      setError('エラーが発生しました。時間をおいて再度お試しください')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 px-4 py-4 pb-8">
      {/* Restaurant name */}
      <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-edge bg-surface p-3">
        <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
            <line x1="6" y1="1" x2="6" y2="4" />
            <line x1="10" y1="1" x2="10" y2="4" />
            <line x1="14" y1="1" x2="14" y2="4" />
          </svg>
        </div>
        <p className="font-bold text-ink">{restaurantName}</p>
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
                  ? `${RATING_ACCENT_BORDER[opt.value]} ${RATING_BG[opt.value]}`
                  : 'border-edge bg-surface hover:bg-canvas'
              }`}
            >
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                rating === opt.value ? RATING_ACCENT_BORDER[opt.value] : 'border-edge'
              }`}>
                {rating === opt.value && (
                  <div className={`h-2.5 w-2.5 rounded-full ${RATING_ACCENT_DOT[opt.value]}`} />
                )}
              </div>
              <div>
                <p className={`font-bold ${rating === opt.value ? RATING_TEXT[opt.value] : 'text-ink'}`}>{opt.label}</p>
                <p className="text-xs text-ink-sub">{opt.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Reason tags */}
      <ReasonTagSelector
        rating={rating}
        selected={reasonKeys}
        onChange={setReasonKeys}
        disabled={submitting}
      />

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
          <span className="absolute bottom-3 right-4 text-xs text-ink-sub">{comment.length} / {MAX_COMMENT}</span>
        </div>
      </div>

      {/* Photo */}
      <div>
        <h2 className="mb-2 text-base font-black text-ink">写真</h2>
        <div className="flex gap-3">
          {displayedImageUrl && (
            <div className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl">
              <Image src={displayedImageUrl} alt="記録の写真" width={80} height={80} className="h-full w-full object-cover" unoptimized />
              <button
                type="button"
                onClick={removeImage}
                disabled={submitting}
                aria-label="写真を外す"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
              >×</button>
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
      <div className="flex items-center justify-between overflow-hidden border-b border-edge py-3">
        <span className="shrink-0 font-black text-ink">訪問日</span>
        <label className="relative flex cursor-pointer items-center gap-2 text-sm text-ink">
          <span>{visitDate ? formatVisitDate(visitDate) : '未設定'}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-terra" aria-hidden="true">
            <path d="M1 1l6 6-6 6" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input type="date" value={visitDate} max={today} onChange={(e) => setVisitDate(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>

      {imageCompressing && (
        <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-sub">画像を圧縮しています...</p>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || imageCompressing}
        className="flex h-[56px] w-full items-center justify-center rounded-xl bg-terra text-base font-bold text-white disabled:opacity-50"
      >
        {submitting ? '保存中...' : '保存する'}
      </button>
    </form>
  )
}
