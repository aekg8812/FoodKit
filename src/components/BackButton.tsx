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
  className = 'block text-sm text-ink-sub transition-colors hover:text-ink',
}: Props) {
  const router = useRouter()

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.replace(fallbackHref)
    }
  }, [router, fallbackHref])

  return (
    <button type="button" onClick={handleBack} className={className}>
      {label}
    </button>
  )
}
