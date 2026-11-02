'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  reviewId: string
  imagePath: string | null
}

export default function DeleteRecordButton({ reviewId, imagePath }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openDialog() {
    setError(null)
    setDialogOpen(true)
  }

  function closeDialog() {
    if (deleting) return
    setDialogOpen(false)
    setError(null)
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)

    const { data, error: deleteError } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)
      .select('id')

    if (deleteError || !data || data.length !== 1) {
      setError('記録を削除できませんでした。時間をおいて再度お試しください')
      setDeleting(false)
      return
    }

    // Storage image deletion is best-effort — orphan is acceptable
    if (imagePath) {
      await supabase.storage.from('review-images').remove([imagePath])
    }

    router.push('/mypage/records')
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label="記録を削除"
        className="flex h-11 w-11 items-center justify-center text-ink-sub"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-record-title"
            className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl"
          >
            <h2 id="delete-record-title" className="text-lg font-bold text-ink">
              この記録を削除しますか？
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-sub">
              削除した記録は元に戻せません。
            </p>

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeDialog}
                disabled={deleting}
                className="flex h-[48px] items-center justify-center rounded-xl border border-edge text-sm font-medium text-ink disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex h-[48px] items-center justify-center rounded-xl bg-red-500 text-sm font-bold text-white disabled:opacity-50"
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
