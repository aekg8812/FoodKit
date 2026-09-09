'use client'

import Link from 'next/link'
import { useState } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'

type FriendsAddMenuProps = {
  activeTab: 'friends' | 'groups'
}

const MENU_LINK_CLASS =
  'flex min-h-[52px] w-full items-center rounded-xl px-4 text-left text-sm font-medium text-ink transition-colors hover:bg-canvas'

export default function FriendsAddMenu({ activeTab }: FriendsAddMenuProps) {
  const [open, setOpen] = useState(false)
  const title = activeTab === 'friends' ? '友人を追加' : 'グループを追加'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${title}メニューを開く`}
        aria-expanded={open}
        aria-controls="friends-add-menu"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terra text-2xl leading-none text-white transition-colors hover:bg-terra-deep"
      >
        <span aria-hidden="true">＋</span>
      </button>

      <BottomSheet
        id="friends-add-menu"
        open={open}
        title={title}
        onClose={() => setOpen(false)}
      >
        {activeTab === 'friends' ? (
          <Link href="/username-test" onClick={() => setOpen(false)} className={MENU_LINK_CLASS}>
            ユーザーIDで探す
          </Link>
        ) : (
          <nav aria-label="グループ追加メニュー" className="space-y-1">
            <Link href="/groups/join" onClick={() => setOpen(false)} className={MENU_LINK_CLASS}>
              グループを作成
            </Link>
            <Link href="/groups/join" onClick={() => setOpen(false)} className={MENU_LINK_CLASS}>
              グループに参加
            </Link>
          </nav>
        )}
      </BottomSheet>
    </>
  )
}
