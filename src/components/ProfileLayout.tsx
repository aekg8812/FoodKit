import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import RatingBadge from '@/components/RatingBadge'
import ValueTypeBadge from '@/components/ValueTypeBadge'
import Card from '@/components/ui/Card'

export type ReviewGridItem = {
  id: string
  restaurantId: string
  restaurantName: string
  rating: number
  imageUrl: string | null
}

export type ProfileLayoutProps = {
  user: {
    id: string
    username: string
    name: string
    avatarUrl: string | null
  }
  friendCount: number
  valueType: string | null
  actions: ReactNode
  reviews: ReviewGridItem[]
  emptyMessage: string
}

export default function ProfileLayout({
  user,
  friendCount,
  valueType,
  actions,
  reviews,
  emptyMessage,
}: ProfileLayoutProps) {
  const avatarFallback = Array.from(user.name.trim())[0] ?? '👤'

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <Card as="section" className="p-6 text-center">
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-cream text-3xl font-bold text-terra">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={`${user.name}のプロフィール画像`}
              fill
              sizes="96px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span aria-hidden="true">{avatarFallback}</span>
          )}
        </div>

        <h1 className="mt-4 break-words text-xl font-bold text-ink">{user.name}</h1>
        <p className="mt-1 break-all text-sm text-ink-sub">@{user.username}</p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm font-medium text-ink">
            友人 <span className="font-bold">{friendCount}</span>人
          </span>
          <ValueTypeBadge type={valueType} />
        </div>

        {actions ? <div className="mt-5">{actions}</div> : null}
      </Card>

      <section aria-labelledby="profile-reviews-heading">
        <h2 id="profile-reviews-heading" className="mb-3 text-lg font-bold text-ink">
          飲食店記録
        </h2>

        {reviews.length === 0 ? (
          <Card className="p-6 text-center text-sm text-ink-sub">{emptyMessage}</Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {reviews.map((review) => (
              <Link
                key={review.id}
                href={`/restaurants/${review.restaurantId}`}
                className="block min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra focus-visible:ring-offset-2"
              >
                <Card interactive className="h-full overflow-hidden">
                  <div className="relative flex aspect-square items-center justify-center bg-canvas">
                    {review.imageUrl ? (
                      <Image
                        src={review.imageUrl}
                        alt={`${review.restaurantName}のレビュー画像`}
                        fill
                        sizes="(max-width: 480px) 50vw, 216px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <span aria-hidden="true" className="text-3xl">
                        🍽️
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="truncate text-sm font-bold text-ink">{review.restaurantName}</p>
                    <RatingBadge rating={review.rating} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
