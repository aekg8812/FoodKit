'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import FriendsAddMenu from './FriendsAddMenu'

const TABS = [
  { id: 'friends', label: '友人' },
  { id: 'groups', label: 'グループ' },
] as const

type TabId = (typeof TABS)[number]['id']

type FriendsTabsProps = {
  friendsPanel: ReactNode
  groupsPanel: ReactNode
}

export default function FriendsTabs({ friendsPanel, groupsPanel }: FriendsTabsProps) {
  const searchParams = useSearchParams()
  const activeTab: TabId = searchParams.get('tab') === 'groups' ? 'groups' : 'friends'

  return (
    <>
      <div className="flex items-end gap-2">
        <nav
          aria-label="友人・グループ表示切替"
          className="grid min-w-0 flex-1 grid-cols-2 border-b border-edge"
          role="tablist"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id

            return (
              <Link
                key={tab.id}
                id={`${tab.id}-tab`}
                href={`/friends?tab=${tab.id}`}
                prefetch={false}
                role="tab"
                aria-controls={`${tab.id}-panel`}
                aria-selected={isActive}
                className={`flex min-h-[44px] items-center justify-center border-b-2 px-2 text-sm font-semibold transition-colors duration-150 ${
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
        <FriendsAddMenu activeTab={activeTab} />
      </div>

      <section
        id={`${activeTab}-panel`}
        role="tabpanel"
        aria-labelledby={`${activeTab}-tab`}
        className="min-h-48"
      >
        {activeTab === 'friends' ? (
          <div className="pt-4">{friendsPanel}</div>
        ) : (
          <div className="pt-4">{groupsPanel}</div>
        )}
      </section>
    </>
  )
}
