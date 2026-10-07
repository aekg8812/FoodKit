import Image from 'next/image'
import Link from 'next/link'
import RatingBadge, { RATING_LABELS } from './RatingBadge'

export type ReviewCardData = {
  review_id: string
  restaurant_id: string
  user_id: string
  username: string | null
  name: string | null
  avatar_path: string | null
  avatar_url: string | null
  rating: number
  comment: string | null
  visit_date: string | null
  image_path: string | null
  image_url: string | null
  created_at: string
}

type Props = {
  review: ReviewCardData
  currentUserId: string
  detailHref?: string
}

export default function ReviewCard({ review, currentUserId, detailHref }: Props) {
  const isOwn = review.user_id === currentUserId
  const initial = Array.from((review.name ?? review.username ?? '?').trim())[0] ?? '?'

  return (
    <div className="rounded-2xl border border-edge bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Link
          href={review.username ? `/users/${review.username}` : '#'}
          className="shrink-0"
          tabIndex={review.username ? 0 : -1}
        >
          {review.avatar_url ? (
            <Image
              src={review.avatar_url}
              alt={review.name ?? review.username ?? ''}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-sm font-semibold text-amber-800">
              {initial}
            </span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <Link
              href={review.username ? `/users/${review.username}` : '#'}
              className="truncate text-sm font-medium text-ink hover:underline"
            >
              {review.name ?? review.username ?? '不明'}
            </Link>
            {review.visit_date && (
              <span className="shrink-0 text-xs text-ink-sub">{review.visit_date}</span>
            )}
          </div>

          {isOwn && (
            <span className="mt-0.5 inline-block rounded-full bg-cream px-2 py-0.5 text-xs font-medium text-amber-800">
              あなたの記録
            </span>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <RatingBadge rating={review.rating} />
            <span className="text-sm text-ink">{RATING_LABELS[review.rating]}</span>
          </div>
        </div>

        {detailHref && (
          <Link href={detailHref} className="shrink-0 text-ink-sub hover:text-ink" aria-label="記録詳細を見る">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </Link>
        )}
      </div>

      {review.comment && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-ink-sub">{review.comment}</p>
      )}

      {review.image_url && (
        <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-lg bg-canvas">
          <Image
            src={review.image_url}
            alt="記録の写真"
            fill
            sizes="(max-width: 448px) 100vw, 400px"
            className="object-cover"
            unoptimized
          />
        </div>
      )}
    </div>
  )
}
