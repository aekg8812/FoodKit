'use client'

import { useRef, useState } from 'react'

const CATEGORIES = [
  { label: '寿司', emoji: '🍣' },
  { label: 'ラーメン', emoji: '🍜' },
  { label: '焼肉', emoji: '🥩' },
  { label: 'カフェ', emoji: '☕' },
  { label: '居酒屋', emoji: '🍶' },
  { label: 'イタリアン', emoji: '🍝' },
  { label: 'カレー', emoji: '🍛' },
] as const

export default function CategoryChips() {
  const [tapped, setTapped] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleTap(label: string) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setTapped(label)
    timerRef.current = setTimeout(() => setTapped(null), 1400)
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.label}
          type="button"
          onClick={() => handleTap(cat.label)}
          className="relative flex shrink-0 min-h-[44px] flex-col items-center gap-1 rounded-2xl border border-edge bg-surface px-4 py-3 transition-all duration-150 motion-safe:active:scale-[0.94]"
        >
          <span className="text-2xl" aria-hidden="true">{cat.emoji}</span>
          <span className="whitespace-nowrap text-xs text-ink-sub">{cat.label}</span>
          {tapped === cat.label && (
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-white whitespace-nowrap">
              近日公開
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
