import Link from 'next/link'
import type { ReactNode } from 'react'

type BackAction =
  | { href: string; onClick?: never }
  | { onClick: () => void; href?: never }

type PageHeaderProps = {
  title: string
  back?: BackAction
  action?: ReactNode
}

export default function PageHeader({ title, back, action }: PageHeaderProps) {
  return (
    <div className="grid min-h-[44px] items-center" style={{ gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)' }}>
      {/* 左: 戻るボタン or 空 */}
      <div className="flex items-center">
        {back && (
          back.href ? (
            <Link
              href={back.href}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-sub transition-colors hover:bg-canvas hover:text-ink"
              aria-label="戻る"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </Link>
          ) : (
            <button
              type="button"
              onClick={back.onClick}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-sub transition-colors hover:bg-canvas hover:text-ink"
              aria-label="戻る"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )
        )}
      </div>

      {/* 中央: タイトル */}
      <h1 className="px-2 text-center text-base font-bold text-ink">{title}</h1>

      {/* 右: アクション or 空 */}
      <div className="flex items-center justify-end">
        {action ?? null}
      </div>
    </div>
  )
}
