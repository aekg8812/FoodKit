'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
    <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cream text-2xl text-terra">
          {displayedAvatarUrl ? (
            <Image
              src={displayedAvatarUrl}
              alt="プロフィール画像のプレビュー"
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span aria-hidden="true">👤</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">プロフィール画像</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-sub">
            JPEG・PNG・WebP、5MB以下
          </p>
        </div>
      </div>

      <input
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        disabled={uploading}
        aria-label="プロフィール画像を選択"
        className="block min-h-[44px] w-full min-w-0 text-sm text-ink-sub file:mr-3 file:min-h-[44px] file:rounded-full file:border-0 file:bg-canvas file:px-4 file:text-sm file:font-medium file:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      />

      {imageFile ? (
        <Button type="submit" loading={uploading} disabled={uploading}>
          {uploading ? '更新中…' : 'プロフィール画像を更新'}
        </Button>
      ) : null}

      {error ? <ErrorMessage message={error} /> : null}
      {successMessage ? (
        <p role="status" className="text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}
    </form>
  )
}
