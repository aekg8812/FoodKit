'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import ErrorMessage from '@/components/ui/ErrorMessage'
import RestaurantMainImage from '@/components/RestaurantMainImage'
import { updateGoogleRestaurantImageAction } from './actions'

const RESTAURANT_IMAGE_BUCKET = 'restaurant-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']

type Props = {
  restaurantId: string
  displayName: string
  formattedAddress: string | null
  mainImagePath: string | null
  currentImageSignedUrl: string | null
}

function buildImagePath(restaurantId: string, file: File): string {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  return `${restaurantId}/${crypto.randomUUID()}.${ext}`
}

export default function GoogleRestaurantEditForm({
  restaurantId,
  displayName,
  formattedAddress,
  mainImagePath,
  currentImageSignedUrl,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    if (imageAction === 'keep') {
      router.push(`/restaurants/${restaurantId}`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      let newImagePath: string | null = null

      if (imageAction === 'replace' && imageFile) {
        const uploadPath = buildImagePath(restaurantId, imageFile)
        const { error: uploadError } = await supabase.storage
          .from(RESTAURANT_IMAGE_BUCKET)
          .upload(uploadPath, imageFile, { contentType: imageFile.type })

        if (uploadError) {
          setError('写真のアップロードに失敗しました。もう一度お試しください')
          return
        }
        newImagePath = uploadPath
      }

      const result = await updateGoogleRestaurantImageAction(
        restaurantId,
        imageAction === 'delete' ? null : newImagePath,
      )

      if (!result.ok) {
        if (newImagePath) {
          await supabase.storage.from(RESTAURANT_IMAGE_BUCKET).remove([newImagePath])
        }
        setError(result.error)
        return
      }

      // DB updated — clean up old image from Storage
      if (mainImagePath && (imageAction === 'replace' || imageAction === 'delete')) {
        await supabase.storage.from(RESTAURANT_IMAGE_BUCKET).remove([mainImagePath])
      }

      router.push(`/restaurants/${restaurantId}`)
    } catch {
      setError('エラーが発生しました。時間をおいて再度お試しください')
    } finally {
      setSubmitting(false)
    }
  }

  const hasChanges = imageAction !== 'keep'

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Link
          href={`/restaurants/${restaurantId}`}
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

        {/* ── Google restaurant info (readonly) ─────────────────────────────── */}
        <div className="rounded-2xl border border-edge bg-surface p-4">
          <p className="text-base font-bold text-ink" translate="no">{displayName}</p>
          {formattedAddress && (
            <p className="mt-0.5 text-sm text-ink-sub" translate="no">{formattedAddress}</p>
          )}
          <p className="mt-2 text-xs text-ink-sub">
            ※ 店名・住所はGoogle Mapsの情報を使用しています
          </p>
        </div>

        {/* ── 店舗メイン写真 ─────────────────────────────────────────────────── */}
        <div>
          <p className="mb-2 text-sm font-bold text-ink">店舗のメイン写真</p>
          <div className="relative h-[160px] w-full overflow-hidden rounded-2xl">
            <RestaurantMainImage src={previewUrl} alt={displayName} />
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

        {error && <ErrorMessage message={error} />}

        <button
          type="submit"
          disabled={submitting}
          className="flex h-[56px] w-full items-center justify-center rounded-xl bg-terra text-base font-bold text-white disabled:opacity-50"
        >
          {submitting ? '保存中...' : hasChanges ? '保存する' : '戻る'}
        </button>
      </form>

      <BottomNav />
    </main>
  )
}
