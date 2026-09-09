'use client'

import { useState } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'

export default function GroupMenu() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="グループメニューを開く"
        aria-expanded={open}
        aria-controls="group-menu"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-surface text-xl font-bold text-ink transition-colors hover:bg-canvas"
      >
        <span aria-hidden="true">≡</span>
      </button>

      <BottomSheet
        id="group-menu"
        open={open}
        title="グループメニュー"
        onClose={() => setOpen(false)}
      >
        <p className="py-4 text-sm text-ink-sub">グループ詳細機能は準備中です</p>
      </BottomSheet>
    </>
  )
}
