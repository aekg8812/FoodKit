'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/home', label: 'ホーム' },
  { href: '/restaurants', label: '店舗' },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 flex h-14 border-t border-edge bg-surface">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === '/home'
            ? pathname === '/home'
            : pathname === item.href || pathname.startsWith(item.href + '/')

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 items-center justify-center text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'text-terra'
                : 'text-ink-sub hover:text-ink motion-safe:active:opacity-70'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
