'use client'

import { useState } from 'react'

type Props = {
  groupName: string
  inviteCode: string
  variant: 'copy-only' | 'share-rows' | 'cta'
}

export default function InviteActions({ groupName, inviteCode, variant }: Props) {
  const [copied, setCopied] = useState(false)

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  function openLine() {
    const text = encodeURIComponent(
      `「${groupName}」に招待します。FoodKitで招待コードを入力してください。\n招待コード: ${inviteCode}`,
    )
    window.open(`https://line.me/R/msg/text/?${text}`, '_blank', 'noopener,noreferrer')
  }

  async function nativeShare() {
    const text = `「${groupName}」に招待します。FoodKitで招待コードを入力してください。\n招待コード: ${inviteCode}`
    if (navigator.share) {
      await navigator.share({ title: `${groupName}への招待`, text })
    } else {
      await copyToClipboard()
    }
  }

  if (variant === 'copy-only') {
    return (
      <button
        type="button"
        onClick={() => void copyToClipboard()}
        className="flex items-center gap-2 rounded-full border border-terra px-6 py-2 text-sm font-medium text-terra transition-colors hover:bg-terra/5"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        {copied ? 'コピーしました ✓' : 'コピー'}
      </button>
    )
  }

  if (variant === 'share-rows') {
    return (
      <div className="divide-y divide-edge rounded-2xl border border-edge bg-surface overflow-hidden">
        {/* Copy row */}
        <button
          type="button"
          onClick={() => void copyToClipboard()}
          className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-canvas transition-colors"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terra/10">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">{copied ? 'コピーしました ✓' : 'コードをコピー'}</p>
            <p className="text-xs text-ink-sub">招待コードをクリップボードにコピー</p>
          </div>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
            <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* LINE row */}
        <button
          type="button"
          onClick={openLine}
          className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-canvas transition-colors"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">LINEで送る</p>
            <p className="text-xs text-ink-sub">友達に招待コードを送信</p>
          </div>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
            <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Other apps row */}
        <button
          type="button"
          onClick={() => void nativeShare()}
          className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-canvas transition-colors"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">他のアプリで共有</p>
            <p className="text-xs text-ink-sub">SNSやメッセージアプリで送信</p>
          </div>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
            <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    )
  }

  // variant === 'cta'
  return (
    <button
      type="button"
      onClick={() => void nativeShare()}
      className="flex h-[52px] w-full items-center justify-center rounded-xl bg-terra text-base font-bold text-white"
    >
      招待コードを共有する
    </button>
  )
}
