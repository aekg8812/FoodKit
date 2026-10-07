'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export type ReviewTab = 'all' | 'similar' | 'following'

export const REVIEW_TAB_LABELS: Record<ReviewTab, string> = {
  all: 'みんな',
  similar: '好みが近い人',
  following: 'フォロー中',
}

type Props = {
  activeTab: ReviewTab
  tabParam?: string
}

export default function ReviewTabsNav({ activeTab, tabParam = 'reviewTab' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleTab = useCallback(
    (tab: ReviewTab) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(tabParam, tab)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams, tabParam],
  )

  return (
    <div className="flex border-b border-edge" role="tablist">
      {(Object.keys(REVIEW_TAB_LABELS) as ReviewTab[]).map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={activeTab === tab}
          onClick={() => handleTab(tab)}
          className={`flex-1 px-2 py-2.5 text-xs font-medium transition-colors ${
            activeTab === tab
              ? 'border-b-2 border-terra text-terra'
              : 'text-ink-sub hover:text-ink'
          }`}
        >
          {REVIEW_TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  )
}
