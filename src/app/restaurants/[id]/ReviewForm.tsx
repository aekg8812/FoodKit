'use client'

import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import TextareaField from '@/components/ui/TextareaField'
import InputField from '@/components/ui/InputField'
import ErrorMessage from '@/components/ui/ErrorMessage'

export type ExistingReview = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  image_path: string | null
  image_url: string | null
}

interface Props {
  restaurantId: string
  existingReview: ExistingReview | null
}

export const RATING_OPTIONS = [4, 3, 2, 1] as const

const RATING_LABELS: Record<number, string> = {
  4: '常連になりたい',
  3: '機会があればまた行きたい',
  2: '一度行けば十分',
  1: '二度と行かない',
}

const RATING_EMOJI: Record<number, string> = {
  4: '🤩',
  3: '😊',
  2: '😐',
  1: '😞',
}

// アクティブ時は分布バーと同系統の色で一貫性を持たせる
const RATING_ACTIVE_CLASS: Record<number, string> = {
  4: 'bg-emerald-500 text-white border-transparent',
  3: 'bg-sky-400 text-white border-transparent',
  2: 'bg-amber-400 text-white border-transparent',
  1: 'bg-red-400 text-white border-transparent',
}

// レビュー画像: V1は1枚、5MB以下のJPEG・PNG・WebPに限定する
const REVIEW_IMAGE_BUCKET = 'review-images'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function logError(err: unknown) {
  if (err !== null && typeof err === 'object') {
    const { message, code, details, hint } = err as Record<string, unknown>
    console.error('[ReviewForm] error:', { message, code, details, hint })
  } else {
    console.error('[ReviewForm] error:', err)
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

function getLocalToday(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ReviewForm({ restaurantId, existingReview }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [rating, setRating] = useState<number | null>(existingReview?.rating ?? null)
  const [comment, setComment] = useState(existingReview?.comment ?? '')
  const [visitDate, setVisitDate] = useState(existingReview?.visit_date ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [removeExistingImage, setRemoveExistingImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = getLocalToday()

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  const displayedImageUrl =
    imagePreviewUrl ??
    (!removeExistingImage ? existingReview?.image_url ?? null : null)

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
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

  function buildImagePath(userId: string, reviewId: string, file: File) {
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    return `${userId}/${reviewId}/${crypto.randomUUID()}.${extension}`
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (rating === null || rating < 1 || rating > 4) return
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

        // レビュー画像: 新しい画像を先に保存し、DB更新失敗時はアップロードを取り消す
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
          await supabase.storage
            .from(REVIEW_IMAGE_BUCKET)
            .remove([existingReview.image_path])
        }
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
        if (insertError) throw insertError

        // レビュー画像: レビューIDを含むパスで保存し、レビューと1対1で紐づける
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
      }

      router.refresh()
    } catch (err) {
      logError(err)
      setError(toJapaneseError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-edge bg-canvas px-4 py-3">
        <p className="text-xs font-medium text-ink-sub">保存先</p>
        <p className="mt-1 text-sm font-medium text-ink">あなたの記録</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-sub">
          このレビューはあなただけに表示されます（グループ共有は近日公開）。
        </p>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-ink">
          評価 <span className="text-red-500">*</span>
        </p>
        <div className="space-y-2">
          {RATING_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRating(r)}
              className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-150 motion-safe:active:scale-[0.98] ${
                rating === r
                  ? RATING_ACTIVE_CLASS[r]
                  : 'border-edge text-ink hover:bg-canvas'
              }`}
            >
              <span className="w-4 shrink-0 font-bold">{r}</span>
              <span aria-hidden="true">{RATING_EMOJI[r]}</span>
              <span>{RATING_LABELS[r]}</span>
            </button>
          ))}
        </div>
      </div>

      <TextareaField
        id="comment"
        label="コメント"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="感想・おすすめポイントなど（任意）"
      />

      <InputField
        id="visit_date"
        label="最後に行った日"
        type="date"
        max={today}
        value={visitDate}
        onChange={(e) => setVisitDate(e.target.value)}
      />

      {/* レビュー画像: 選択直後にプレビューし、投稿前に取り外せるようにする */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="review_image" className="text-sm font-medium text-ink">
            食事の写真 <span className="font-normal text-ink-sub">（任意）</span>
          </label>
          <span className="text-xs text-ink-sub">1枚まで</span>
        </div>

        {displayedImageUrl ? (
          /* レビュー画像UI: 写真を大きく見せ、変更と取り外しを画像上にまとめる */
          <div className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-edge bg-canvas">
            <Image
              src={displayedImageUrl}
              alt="投稿する食事の写真"
              fill
              sizes="(max-width: 448px) 100vw, 400px"
              className="object-cover"
              unoptimized
            />
            <button
              type="button"
              onClick={removeImage}
              disabled={submitting}
              aria-label="写真を外す"
              title="写真を外す"
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-xl text-white shadow-sm transition-colors hover:bg-black/80 disabled:opacity-50"
            >
              ×
            </button>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-black/65 px-4 py-3 text-white">
              <p className="min-w-0 truncate text-xs">
                {imageFile?.name ?? '登録済みの写真'}
              </p>
              <label
                htmlFor="review_image"
                className="shrink-0 cursor-pointer text-sm font-medium underline underline-offset-4"
              >
                写真を変更
              </label>
            </div>
          </div>
        ) : (
          /* レビュー画像UI: 未選択時はタップ範囲の広い追加エリアを表示する */
          <label
            htmlFor="review_image"
            className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-edge bg-canvas px-5 py-6 text-center transition-colors hover:border-terra hover:bg-terra/5"
          >
            <span
              aria-hidden="true"
              className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-2xl text-terra shadow-sm"
            >
              ＋
            </span>
            <span className="text-sm font-medium text-ink">写真を追加</span>
            <span className="mt-1 text-xs text-ink-sub">JPEG・PNG・WebP、5MBまで</span>
          </label>
        )}
        <input
          id="review_image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={submitting}
          onChange={handleImageChange}
          className="sr-only"
        />
      </div>

      {error && <ErrorMessage message={error} />}

      <Button
        type="submit"
        disabled={submitting || rating === null}
      >
        {submitting
          ? '送信中...'
          : existingReview
            ? 'グループの投稿を更新'
            : 'グループに投稿する'}
      </Button>
    </form>
  )
}
