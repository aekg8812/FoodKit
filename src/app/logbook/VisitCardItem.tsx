import Image from 'next/image'
import Link from 'next/link'
import { RATING_BG, RATING_TEXT, RATING_BORDER, RATING_LABELS } from '@/lib/rating/colors'
import RatingBadgeIcon from './RatingBadgeIcon'
import type { VisitCard } from './types'

const LABEL_LABEL: Record<string, string> = {
  solo: 'ひとり向き',
  friends: '友達向き',
  date: 'デート向き',
  large_group: '大人数向き',
  calm: '落ち着く',
  lively: 'にぎやか',
  stylish: 'おしゃれ',
  casual: 'カジュアル',
  quick: 'サクッと利用',
  long_stay: '長居しやすい',
  hearty: 'がっつり',
  photogenic: '写真映え',
}

const REASON_LABEL: Record<string, string> = {
  taste: '味',
  value: 'コスパ',
  atmosphere: '雰囲気',
  service: '接客',
  volume: 'ボリューム',
  access: 'アクセス',
}

type Props = {
  card: VisitCard
  visitCount: number
}

export function VisitCardItem({ card, visitCount }: Props) {
  const labelTags = card.labelKeys.map(k => LABEL_LABEL[k]).filter(Boolean)
  const reasonTags = card.reasonKeys.map(k => REASON_LABEL[k]).filter(Boolean)
  const displayTags = [...labelTags, ...reasonTags].slice(0, 2)

  return (
    <article
      className="relative isolate overflow-hidden rounded-[18px] border border-edge bg-surface shadow-[0_1px_6px_rgba(98,55,31,0.05)]"
    >
      {/* Full-card invisible link */}
      <Link
        href={`/visits/${card.id}`}
        className="absolute inset-0 z-0 rounded-[18px] transition-colors hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra/40 focus-visible:ring-offset-1"
        aria-label={`${card.restaurantName}の記録を見る`}
      />

      <div className="pointer-events-none flex gap-3 p-3">
        {/* Photo 88×88px */}
        <div className="relative h-[88px] w-[88px] shrink-0 self-start overflow-hidden rounded-[14px] bg-[#F3E5D8]">
          {card.imageUrl ? (
            <Image
              src={card.imageUrl}
              alt={`${card.restaurantName}の記録写真`}
              fill
              sizes="88px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 py-0.5">
          {/* Row 1: restaurant name (full width, up to 2 lines) */}
          <p
            className="line-clamp-2 text-base font-bold leading-snug text-ink"
            translate={card.restaurantSource === 'google_place' ? 'no' : undefined}
          >
            {card.restaurantName}
          </p>

          {/* Row 2: rating badge */}
          <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${RATING_BG[card.rating]} ${RATING_TEXT[card.rating]} ${RATING_BORDER[card.rating]}`}>
            <RatingBadgeIcon rating={card.rating} />
            {RATING_LABELS[card.rating]}
          </span>

          {/* Row 3: genre · area */}
          {(card.restaurantGenre || card.restaurantArea) && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-sub">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
              </svg>
              {[card.restaurantGenre, card.restaurantArea].filter(Boolean).join('・')}
            </p>
          )}

          {/* Row 4: visit count pill + comment */}
          <div className="mt-1.5 flex items-start gap-2">
            <Link
              href={`/mypage/records/${card.restaurantId}`}
              className="pointer-events-auto relative z-10 inline-flex shrink-0 items-center gap-1 rounded-full bg-terra/10 px-2 py-0.5 text-[11px] font-bold text-terra transition-colors hover:bg-terra/20"
              aria-label={`${card.restaurantName}の全来店履歴（${visitCount}回）を見る`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {visitCount}回来店
            </Link>
            {card.comment && (
              <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-relaxed text-ink-sub">
                {card.comment}
              </p>
            )}
          </div>

          {/* Row 5: label tags */}
          {displayTags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {displayTags.map((tag, i) => (
                <span
                  key={i}
                  className="rounded-full bg-[#FFF0E1] px-2.5 py-0.5 text-[11px] font-semibold text-terra/80"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Chevron */}
        <div className="self-center">
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="text-ink-sub/40" aria-hidden="true">
            <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </article>
  )
}
