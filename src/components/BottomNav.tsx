'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/home',    label: 'ホーム',     emoji: '🏠' },
  { href: '/search',  label: '検索',       emoji: '🔍' },
  { href: '/record',  label: '記録',       emoji: '📝' },
  { href: '/groups',  label: 'グループ',   emoji: '👥' },
  { href: '/mypage',  label: 'マイページ', emoji: '👤' },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  function isItemActive(href: string): boolean {
    if (href === '/home') {
      return pathname === '/home' || pathname.startsWith('/restaurants')
    }
    if (href === '/search') {
      return pathname === '/search' || pathname.startsWith('/search/')
    }
    if (href === '/record') {
      return pathname === '/record' || pathname.startsWith('/record/') || pathname.startsWith('/records/')
    }
    if (href === '/groups') {
      return (
        pathname === '/groups' ||
        pathname.startsWith('/groups/') ||
        pathname === '/friends' ||
        pathname.startsWith('/friends/')
      )
    }
    if (href === '/mypage') {
      return pathname === '/mypage' || pathname.startsWith('/mypage/')
    }
    return pathname === href
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 flex h-14 border-t border-edge bg-surface">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch={false}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-all duration-150 ${
            isItemActive(item.href)
              ? 'text-terra'
              : 'text-ink-sub hover:text-ink motion-safe:active:opacity-70'
          }`}
        >
          <span className="text-base leading-none" aria-hidden="true">{item.emoji}</span>
          <span className="text-[10px] font-medium leading-none">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
