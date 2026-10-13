'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import { submitGooglePlaceReviewAction } from './actions'

type Props = {
  placeId: string
  googleDisplayName: string | null
  googleFormattedAddress: string | null
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

export default function GooglePlaceRecordForm({
  placeId,
  googleDisplayName,
  googleFormattedAddress,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const today = getLocalToday()

  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [visitDate, setVisitDate] = useState(today)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

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
    setError(null)
  }

  function removeImage() {
    setImageFile(null)
    setImagePreviewUrl(null)
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

    let uploadedImagePath: string | null = null

    try {
      // Upload image first (before calling RPC so we have the path)
      if (imageFile) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error('Authentication is required')

        const ext =
          imageFile.type === 'image/png'
            ? 'png'
            : imageFile.type === 'image/webp'
              ? 'webp'
              : 'jpg'
        uploadedImagePath = `${user.id}/${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from(REVIEW_IMAGE_BUCKET)
          .upload(uploadedImagePath, imageFile, { contentType: imageFile.type })

        if (uploadError) throw uploadError
      }

      const result = await submitGooglePlaceReviewAction({
        placeId,
        rating,
        comment,
        visitDate,
        imagePath: uploadedImagePath,
      })

      if (!result.ok) {
        // Delete orphaned image if RPC failed
        if (uploadedImagePath) {
          await supabase.storage.from(REVIEW_IMAGE_BUCKET).remove([uploadedImagePath])
        }
        setError(result.error)
        setSubmitting(false)
        return
      }

      router.push(`/restaurants/${result.restaurantId}`)
    } catch {
      if (uploadedImagePath) {
        await supabase.storage.from(REVIEW_IMAGE_BUCKET).remove([uploadedImagePath])
      }
      setError('エラーが発生しました。時間をおいて再度お試しください')
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Link
          href="/record"
          className="flex h-10 w-10 items-center justify-center text-ink"
          aria-label="閉じる"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-ink">記録する</h1>
        <div className="w-10" />
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 px-4 pt-4 pb-8">

        {/* Google place hint card */}
        <div className="flex items-start gap-3 overflow-hidden rounded-2xl border border-edge bg-surface p-3">
          <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#C9A98A"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="font-bold text-ink"
              translate="no"
            >
              {googleDisplayName ?? '店舗情報を読み込み中...'}
            </p>
            {googleFormattedAddress && (
              <p className="mt-0.5 line-clamp-2 text-xs text-ink-sub" translate="no">
                {googleFormattedAddress}
              </p>
            )}
            <p className="mt-1 text-[10px] text-ink-sub" translate="no">
              Google Maps
            </p>
          </div>
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
                onClick={() => setRating(opt.value)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                  rating === opt.value
                    ? 'border-terra bg-[#FFF3EC]'
                    : 'border-edge bg-surface hover:bg-canvas'
                }`}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    rating === opt.value ? 'border-terra' : 'border-edge'
                  }`}
                >
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
            {imagePreviewUrl && (
              <div className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl">
                <Image
                  src={imagePreviewUrl}
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
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
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
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <svg
              width="8"
              height="14"
              viewBox="0 0 8 14"
              fill="none"
              className="text-terra"
              aria-hidden="true"
            >
              <path
                d="M1 1l6 6-6 6"
                stroke="#F97316"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || rating === null}
          className="flex h-[56px] w-full items-center justify-center rounded-xl bg-terra text-base font-bold text-white disabled:opacity-50"
        >
          {submitting ? '記録中...' : '記録する'}
        </button>
      </form>

      <BottomNav />
    </main>
  )
}
