'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomSheet from '@/components/ui/BottomSheet'
import { createClient } from '@/lib/supabase/client'

export default function SettingsLogoutSection() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[56px] w-full items-center justify-center gap-2 px-4 py-3 text-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span className="font-bold text-red-600">ログアウト</span>
      </button>

      <BottomSheet
        id="logout-confirm"
        open={open}
        title="ログアウト"
        onClose={() => setOpen(false)}
      >
        <p className="mb-6 text-sm leading-relaxed text-ink-sub">
          ログアウトしますか？
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="min-h-[44px] rounded-full border border-edge px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loading}
            className="min-h-[44px] rounded-full bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'ログアウト中...' : 'ログアウト'}
          </button>
        </div>
      </BottomSheet>
    </>
  )
}
