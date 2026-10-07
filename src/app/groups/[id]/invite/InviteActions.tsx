'use client'

import { useState } from 'react'

type Props = {
  groupName: string
  inviteCode: string
}

export default function InviteActions({ groupName, inviteCode }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select the code element
    }
  }

  function handleShare() {
    const text = `「${groupName}」に招待します。FoodKitで招待コードを入力してください。\n招待コード: ${inviteCode}`
    if (navigator.share) {
      void navigator.share({ title: `${groupName}への招待`, text })
    } else {
      void navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleLine() {
    const text = encodeURIComponent(
      `「${groupName}」に招待します。FoodKitで招待コードを入力してください。\n招待コード: ${inviteCode}`,
    )
    window.open(`https://line.me/R/msg/text/?${text}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="flex min-h-11 w-full items-center justify-center rounded-full border border-edge bg-surface text-sm font-medium text-ink transition-colors hover:bg-canvas"
      >
        {copied ? 'コピーしました ✓' : 'コードをコピー'}
      </button>
      <button
        type="button"
        onClick={handleShare}
        className="flex min-h-11 w-full items-center justify-center rounded-full bg-terra text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        シェアする
      </button>
      <button
        type="button"
        onClick={handleLine}
        className="flex min-h-11 w-full items-center justify-center rounded-full bg-[#06C755] text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        LINEで送る
      </button>
    </div>
  )
}
