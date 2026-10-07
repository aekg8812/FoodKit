'use client'

import { useCallback } from 'react'

type Props = {
  title: string
  text?: string
  url?: string
}

export default function ShareButton({ title, text, url }: Props) {
  const handleShare = useCallback(async () => {
    const shareUrl =
      url && url.startsWith('http')
        ? url
        : typeof window !== 'undefined'
          ? window.location.href
          : url ?? ''

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl })
      } catch {
        // AbortError = user cancelled, ignore
      }
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      alert('URLをコピーしました')
    } catch {
      alert(`URLをコピーしてください:\n${shareUrl}`)
    }
  }, [title, text, url])

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex items-center gap-1.5 rounded-full border border-edge bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas active:bg-canvas"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.474l6.733-3.366A2.52 2.52 0 0 1 13 4.5Z" />
      </svg>
      共有
    </button>
  )
}
