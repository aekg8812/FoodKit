'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const TABS = [
  { id: 'friends', label: '友人' },
  { id: 'groups', label: 'グループ' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function FriendsTabs() {
  const searchParams = useSearchParams()
  const activeTab: TabId = searchParams.get('tab') === 'groups' ? 'groups' : 'friends'

  return (
    <>
      <nav
        aria-label="友人・グループ表示切替"
        className="grid grid-cols-2 border-b border-edge"
        role="tablist"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id

          return (
            <Link
              key={tab.id}
              id={`${tab.id}-tab`}
              href={`/friends?tab=${tab.id}`}
              role="tab"
              aria-controls={`${tab.id}-panel`}
              aria-selected={isActive}
              className={`flex min-h-[44px] items-center justify-center border-b-2 px-4 text-sm font-semibold transition-colors duration-150 ${
                isActive
                  ? 'border-terra text-terra'
                  : 'border-transparent text-ink-sub hover:text-ink'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <section
        id={`${activeTab}-panel`}
        role="tabpanel"
        aria-labelledby={`${activeTab}-tab`}
        className="min-h-48"
      />
    </>
  )
}
