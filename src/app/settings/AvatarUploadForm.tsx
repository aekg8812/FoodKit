'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/client'

const AVATAR_BUCKET = 'avatars'
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type AvatarUploadFormProps = {
  userId: string
  currentAvatarUrl: string | null
}

function logError(error: unknown) {
  if (error !== null && typeof error === 'object') {
    const { message, code, details, hint } = error as Record<string, unknown>
    console.error('[AvatarUploadForm] error:', message, code, details, hint)
    return
  }
  console.error('[AvatarUploadForm] error:', error)
}

export default function AvatarUploadForm({
  userId,
  currentAvatarUrl,
}: AvatarUploadFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('JPEG・PNG・WebP形式の画像を選んでください')
      setSuccessMessage(null)
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('画像は5MB以下にしてください')
      setSuccessMessage(null)
      return
    }

    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setError(null)
    setSuccessMessage(null)
  }

  async function handleUpload() {
    if (!imageFile || uploading) return

    setUploading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const path = `${userId}/icon.jpg`
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, imageFile, {
          upsert: true,
          contentType: imageFile.type,
        })
      if (uploadError) throw uploadError

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_path: path })
        .eq('id', userId)
        .select('avatar_path')
        .single()
      if (updateError) throw updateError

      setImageFile(null)
      setSuccessMessage('プロフィール画像を更新しました')
      router.refresh()
    } catch (uploadError) {
      logError(uploadError)
      setError('プロフィール画像を更新できませんでした。時間をおいて再度お試しください')
    } finally {
      setUploading(false)
    }
  }

  const displayedAvatarUrl = previewUrl ?? currentAvatarUrl

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6">
      {/* Avatar circle */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F3E5D8] text-3xl text-terra"
        aria-label="プロフィール画像を変更"
      >
        {displayedAvatarUrl ? (
          <Image
            src={displayedAvatarUrl}
            alt="プロフィール画像のプレビュー"
            fill
            sizes="80px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <span aria-hidden="true" className="text-[#C9A98A]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
        )}
      </button>

      {/* Trigger text */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="text-sm font-bold text-terra disabled:opacity-50"
      >
        写真を変更
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleImageChange}
        disabled={uploading}
        aria-label="プロフィール画像を選択"
        className="sr-only"
      />

      {/* Upload CTA appears after image is selected */}
      {imageFile && (
        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={uploading}
          className="flex min-h-[40px] items-center rounded-xl bg-terra px-6 text-sm font-bold text-white disabled:opacity-50"
        >
          {uploading ? '更新中…' : 'この写真にする'}
        </button>
      )}

      {error ? <ErrorMessage message={error} /> : null}
      {successMessage ? (
        <p role="status" className="text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}
    </div>
  )
}
