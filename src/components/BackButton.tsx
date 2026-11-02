'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  fallbackHref: string
  label?: string
  className?: string
}

export default function BackButton({
  fallbackHref,
  label = '← 戻る',
  className,
}: Props) {
  const router = useRouter()

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.replace(fallbackHref)
    }
  }, [router, fallbackHref])

  // label="" → icon-only mode: render a chevron, apply icon-button default class
  const iconMode = label === ''
  const resolvedClass = className ?? (
    iconMode
      ? 'flex h-11 w-11 items-center justify-center text-ink'
      : 'block text-sm text-ink-sub transition-colors hover:text-ink'
  )

  return (
    <button
      type="button"
      onClick={handleBack}
      className={resolvedClass}
      aria-label={iconMode ? '戻る' : undefined}
    >
      {iconMode ? (
        <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
          <path
            d="M9 1 L1 9 L9 17"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        label
      )}
    </button>
  )
}
