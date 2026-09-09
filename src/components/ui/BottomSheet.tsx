'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

type BottomSheetProps = {
  id: string
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export default function BottomSheet({
  id,
  open,
  title,
  onClose,
  children,
}: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = `${id}-title`

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      id={id}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        dialogRef.current?.close()
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close()
      }}
      className="fixed inset-0 z-20 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-ink/40 open:flex open:items-end"
    >
      <section className="w-full rounded-t-3xl bg-surface px-6 pb-8 pt-4 shadow-lg">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-edge" aria-hidden="true" />
        <div className="mx-auto w-full max-w-md">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id={titleId} className="text-lg font-bold text-ink">
              {title}
            </h2>
            <button
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-ink-sub transition-colors hover:bg-canvas hover:text-ink"
              aria-label="メニューを閉じる"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      </section>
    </dialog>
  )
}
