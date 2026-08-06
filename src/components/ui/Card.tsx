import { type ReactNode } from 'react'

interface CardProps {
  as?: 'div' | 'section' | 'article'
  /** true: hover で影が浮き上がりタップ時に沈む。リンク内に置く店舗カード等に使う。 */
  interactive?: boolean
  children: ReactNode
  className?: string
}

const INTERACTIVE_CLASSES =
  'transition-all duration-150 hover:shadow-md motion-safe:active:scale-[0.99] cursor-pointer'

export default function Card({
  as: Tag = 'div',
  interactive = false,
  children,
  className = '',
}: CardProps) {
  return (
    <Tag
      className={`rounded-2xl border border-edge bg-surface shadow-sm ${interactive ? INTERACTIVE_CLASSES : ''} ${className}`}
    >
      {children}
    </Tag>
  )
}
