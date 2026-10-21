'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import ErrorMessage from '@/components/ui/ErrorMessage'
import RestaurantMainImage from '@/components/RestaurantMainImage'

const RESTAURANT_IMAGE_BUCKET = 'restaurant-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']

type Props = {
  restaurantId: string
  restaurantName: string
  isGoogleRestaurant: boolean
  currentImagePath: string | null
  currentImageSignedUrl: string | null
  canManage: boolean  // owner or uploader (for replace/delete); false = reviewer first-upload
}

type RpcResult = { status: string; old_path?: string | null }

function buildImagePath(restaurantId: string, file: File): string {
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  return `${restaurantId}/${crypto.randomUUID()}.${ext}`
}

export default function RestaurantImageForm({
  restaurantId,
  restaurantName,
  isGoogleRestaurant,
  currentImagePath,
  currentImageSignedUrl,
  canManage,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasCurrentImage = currentImagePath !== null
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageSignedUrl)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError(null)
    setPendingDelete(false)

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
  }

  function handleCancelSelect() {
    setImageFile(null)
    setPreviewUrl(currentImageSignedUrl)
    setImageError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleAddOrReplace() {
    if (!imageFile || submitting) return
    setSubmitting(true)
    setError(null)

    const uploadPath = buildImagePath(restaurantId, imageFile)
    const { error: uploadError } = await supabase.storage
      .from(RESTAURANT_IMAGE_BUCKET)
      .upload(uploadPath, imageFile, { contentType: imageFile.type })

    if (uploadError) {
      setError('写真のアップロードに失敗しました。もう一度お試しください')
      setSubmitting(false)
      return
    }

    if (!hasCurrentImage) {
      // First upload: atomic claim
      const { data, error: rpcError } = await supabase.rpc('claim_restaurant_main_image', {
        p_restaurant_id: restaurantId,
        p_image_path: uploadPath,
      })

      if (rpcError || !data) {
        await supabase.storage.from(RESTAURANT_IMAGE_BUCKET).remove([uploadPath])
        setError('写真の登録に失敗しました。時間をおいて再度お試しください')
        setSubmitting(false)
        return
      }

      const result = data as RpcResult
      if (result.status === 'already_claimed') {
        await supabase.storage.from(RESTAURANT_IMAGE_BUCKET).remove([uploadPath])
        setError('先に他のユーザーが写真を登録しました。ページを更新して確認してください')
        setSubmitting(false)
        return
      }
      if (result.status !== 'ok') {
        await supabase.storage.from(RESTAURANT_IMAGE_BUCKET).remove([uploadPath])
        setError('写真の登録に失敗しました。時間をおいて再度お試しください')
        setSubmitting(false)
        return
      }
    } else {
      // Replace existing image
      const { data, error: rpcError } = await supabase.rpc('replace_restaurant_main_image', {
        p_restaurant_id: restaurantId,
        p_image_path: uploadPath,
      })

      if (rpcError || !data) {
        await supabase.storage.from(RESTAURANT_IMAGE_BUCKET).remove([uploadPath])
        setError('写真の変更に失敗しました。時間をおいて再度お試しください')
        setSubmitting(false)
        return
      }

      const result = data as RpcResult
      if (result.status !== 'ok') {
        await supabase.storage.from(RESTAURANT_IMAGE_BUCKET).remove([uploadPath])
        setError('写真の変更に失敗しました。時間をおいて再度お試しください')
        setSubmitting(false)
        return
      }

      // Delete old file from Storage (best-effort; orphan is acceptable)
      if (result.old_path) {
        await supabase.storage.from(RESTAURANT_IMAGE_BUCKET).remove([result.old_path])
      }
    }

    router.push(`/restaurants/${restaurantId}`)
  }

  async function handleDelete() {
    if (!canManage || submitting) return
    setSubmitting(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('delete_restaurant_main_image', {
      p_restaurant_id: restaurantId,
    })

    if (rpcError || !data) {
      setError('写真の削除に失敗しました。時間をおいて再度お試しください')
      setSubmitting(false)
      return
    }

    const result = data as RpcResult
    if (result.status !== 'ok') {
      setError('写真の削除に失敗しました。時間をおいて再度お試しください')
      setSubmitting(false)
      return
    }

    // DB updated — remove from Storage (best-effort)
    if (result.old_path) {
      await supabase.storage.from(RESTAURANT_IMAGE_BUCKET).remove([result.old_path])
    }

    router.push(`/restaurants/${restaurantId}`)
  }

  const hasNewFile = imageFile !== null

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
        <h1 className="flex-1 text-center text-base font-bold text-ink">店舗の写真</h1>
        <div className="w-10" />
      </div>

      <div className="space-y-5 px-4 pt-4 pb-8">

        {/* Restaurant name */}
        <p
          className="text-base font-bold text-ink"
          translate={isGoogleRestaurant ? 'no' : undefined}
        >
          {restaurantName}
        </p>

        {/* Image preview */}
        <div>
          <div className="relative h-[200px] w-full overflow-hidden rounded-2xl">
            <RestaurantMainImage src={previewUrl} alt={restaurantName} />
          </div>
          {imageError && <p className="mt-1.5 text-xs text-red-600">{imageError}</p>}
        </div>

        {/* Image actions */}
        {!pendingDelete && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-terra px-3 text-sm font-medium text-terra disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {previewUrl ? '写真を変更' : '写真を追加'}
            </button>

            {hasCurrentImage && canManage && !hasNewFile && (
              <button
                type="button"
                onClick={() => setPendingDelete(true)}
                disabled={submitting}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-edge px-3 text-sm font-medium text-ink-sub disabled:opacity-50"
              >
                写真を削除
              </button>
            )}

            {hasNewFile && (
              <button
                type="button"
                onClick={handleCancelSelect}
                disabled={submitting}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-edge px-3 text-sm font-medium text-ink-sub disabled:opacity-50"
              >
                キャンセル
              </button>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />

        {error && <ErrorMessage message={error} />}

        {/* Delete confirmation */}
        {pendingDelete && (
          <div className="rounded-2xl border border-edge bg-surface p-4">
            <p className="text-sm font-medium text-ink">この店舗の写真を削除しますか？</p>
            <p className="mt-1 text-xs text-ink-sub">削除後は元に戻せません。</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={submitting}
                className="flex h-10 flex-1 items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white disabled:opacity-50"
              >
                {submitting ? '削除中...' : '削除する'}
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(false)}
                disabled={submitting}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-edge text-sm font-medium text-ink disabled:opacity-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Save button for add/replace */}
        {!pendingDelete && hasNewFile && (
          <button
            type="button"
            onClick={() => void handleAddOrReplace()}
            disabled={submitting}
            className="flex h-[56px] w-full items-center justify-center rounded-xl bg-terra text-base font-bold text-white disabled:opacity-50"
          >
            {submitting ? '保存中...' : '保存する'}
          </button>
        )}

        {/* Back to restaurant if no changes pending */}
        {!pendingDelete && !hasNewFile && (
          <Link
            href={`/restaurants/${restaurantId}`}
            className="flex h-[56px] w-full items-center justify-center rounded-xl border border-edge text-sm font-medium text-ink"
          >
            戻る
          </Link>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
