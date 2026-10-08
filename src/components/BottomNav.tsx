'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.75L12 3l9 6.75V21a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.75Z" />
      <path d="M9 22V12h6v10" />
    </svg>
  )
}

function IconSearch({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function IconRecord() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconGroups({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-2a5 5 0 0 1 5-5h2" />
      <circle cx="17" cy="9" r="3" />
      <path d="M21 21v-2a5 5 0 0 0-5-5h-2" />
    </svg>
  )
}

function IconMypage({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

const SIDE_ITEMS = [
  { href: '/home',   label: 'ホーム',     Icon: IconHome },
  { href: '/search', label: '検索',       Icon: IconSearch },
] as const

const RIGHT_ITEMS = [
  { href: '/groups', label: 'グループ',   Icon: IconGroups },
  { href: '/mypage', label: 'マイページ', Icon: IconMypage },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  function isActive(href: string): boolean {
    if (href === '/home') {
      return pathname === '/home' || pathname.startsWith('/restaurants') || pathname.startsWith('/notifications')
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
      return (
        pathname === '/mypage' ||
        pathname.startsWith('/mypage/') ||
        pathname === '/settings' ||
        pathname.startsWith('/settings/')
      )
    }
    return pathname === href
  }

  const recordActive = pathname === '/record' || pathname.startsWith('/record/') || pathname.startsWith('/records/')

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 flex h-16 items-end border-t border-edge bg-surface pb-2 shadow-[0_-1px_0_0_rgba(0,0,0,0.06)]">
      {/* Left side: ホーム + 検索 */}
      {SIDE_ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            className={`flex flex-1 flex-col items-center justify-end gap-0.5 pb-0.5 transition-colors duration-150 ${
              active ? 'text-terra' : 'text-ink-sub hover:text-ink'
            }`}
          >
            <Icon active={active} />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </Link>
        )
      })}

      {/* Center: 記録 — special orange circle button */}
      <div className="flex flex-1 flex-col items-center justify-end pb-0.5">
        <Link
          href="/record"
          prefetch={false}
          aria-label="記録する"
          className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-terra shadow-md transition-all duration-150 hover:bg-terra-deep active:scale-95"
          style={{ boxShadow: '0 4px 12px rgba(249,115,22,0.4)' }}
        >
          <IconRecord />
        </Link>
        <span className={`text-[10px] font-medium leading-none ${recordActive ? 'text-terra' : 'text-ink-sub'}`}>記録</span>
      </div>

      {/* Right side: グループ + マイページ */}
      {RIGHT_ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            className={`flex flex-1 flex-col items-center justify-end gap-0.5 pb-0.5 transition-colors duration-150 ${
              active ? 'text-terra' : 'text-ink-sub hover:text-ink'
            }`}
          >
            <Icon active={active} />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
