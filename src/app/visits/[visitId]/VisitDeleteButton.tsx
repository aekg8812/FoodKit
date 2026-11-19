'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  visitId: string
  restaurantId: string
  imagePath: string | null
}

type DeleteVisitResult = {
  deleted: boolean
  review_deleted: boolean
  was_representative: boolean
  deleted_image_path: string | null
  new_rep_visit_id?: string
}

async function safeDeleteImage(supabase: ReturnType<typeof import('@/lib/supabase/client').createClient>, path: string) {
  // Only delete if no other visit or review still references this path
  const [{ count: visitRefs }, { count: reviewRefs }] = await Promise.all([
    supabase
      .from('restaurant_visits')
      .select('id', { count: 'exact', head: true })
      .eq('image_path', path),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('image_path', path),
  ])
  if ((visitRefs ?? 1) === 0 && (reviewRefs ?? 1) === 0) {
    await supabase.storage.from('review-images').remove([path]).catch(() => {})
  }
}

export default function VisitDeleteButton({ visitId, restaurantId, imagePath }: Props) {
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

    const { data, error: rpcError } = await supabase.rpc('delete_visit', {
      p_visit_id: visitId,
    })

    if (rpcError) {
      setError('削除できませんでした。時間をおいて再度お試しください')
      setDeleting(false)
      return
    }

    const result = data as DeleteVisitResult

    // Safe image cleanup — only after confirmed DB deletion
    if (result.deleted_image_path) {
      await safeDeleteImage(supabase, result.deleted_image_path)
    }

    if (result.review_deleted) {
      // Last visit deleted → no more visits for this restaurant
      router.push('/mypage/records')
    } else {
      // Visits remain → show remaining visit history for this restaurant
      router.push(`/mypage/records/${restaurantId}`)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label="来店記録を削除"
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
            aria-labelledby="delete-visit-title"
            className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl"
          >
            <h2 id="delete-visit-title" className="text-lg font-bold text-ink">
              この来店記録を削除しますか？
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-sub">
              削除した記録は元に戻せません。
            </p>

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
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
