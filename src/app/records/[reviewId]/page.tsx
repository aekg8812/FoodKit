import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import RatingBadge, { RATING_LABELS } from '@/components/RatingBadge'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import { getUserState } from '@/lib/auth/getUserState'

type ReviewRow = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  created_at: string
  image_path: string | null
  user_id: string
  restaurant_id: string
  restaurants: {
    id: string
    name: string
    area: string | null
    genre: string | null
    address: string | null
  } | null
}

type UserProfile = {
  id: string
  username: string | null
  name: string | null
  avatar_path: string | null
  updated_at: string | null
}

type PageProps = {
  params: Promise<{ reviewId: string }>
}

export default async function RecordDetailPage({ params }: PageProps) {
  const { reviewId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/records/[reviewId]', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data: reviewData, error: reviewError } = await supabase
    .from('reviews')
    .select(
      'id, rating, comment, visit_date, created_at, image_path, user_id, restaurant_id, restaurants(id, name, area, genre, address)',
    )
    .eq('id', reviewId)
    .maybeSingle()

  if (reviewError) {
    throw new Error(`RecordDetailPage: review query failed: ${reviewError.message}`)
  }
  if (!reviewData) notFound()

  const review = reviewData as unknown as ReviewRow

  // Load reviewer profile
  const { data: profileData, error: profileError } = await supabase
    .from('user_public_profiles')
    .select('id, username, name, avatar_path, updated_at')
    .eq('id', review.user_id)
    .maybeSingle()

  if (profileError) {
    throw new Error(`RecordDetailPage: profile query failed: ${profileError.message}`)
  }

  const profile = profileData as UserProfile | null

  // Signed URL for review image
  let imageUrl: string | null = null
  if (review.image_path) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from('review-images')
      .createSignedUrl(review.image_path, 60 * 60)
    if (signedError) {
      console.error('RecordDetailPage: failed to sign review image', signedError)
    } else {
      imageUrl = signedData?.signedUrl ?? null
    }
  }

  // Avatar URL (public bucket)
  const avatarUrl = profile?.avatar_path
    ? (() => {
        const raw = supabase.storage.from('avatars').getPublicUrl(profile.avatar_path!).data
          .publicUrl
        return profile.updated_at
          ? `${raw}?v=${encodeURIComponent(profile.updated_at)}`
          : raw
      })()
    : null

  const isOwn = review.user_id === user.id
  const initial = Array.from((profile?.name ?? profile?.username ?? '?').trim())[0] ?? '?'
  const restaurant = review.restaurants

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 pb-20">
      <div className="mx-auto max-w-md space-y-4">
        {/* Back: browser history を使うので遷入元 (records list, user profile, etc) へ戻る */}
        <Suspense>
          <BackButton
            fallbackHref={restaurant ? `/restaurants/${restaurant.id}` : '/restaurants'}
          />
        </Suspense>

        {/* Reviewer info */}
        <section className="rounded-2xl border border-edge bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Link
              href={profile?.username ? `/users/${profile.username}` : '#'}
              className="shrink-0"
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={profile?.name ?? profile?.username ?? ''}
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream text-base font-semibold text-amber-800">
                  {initial}
                </span>
              )}
            </Link>
            <div className="min-w-0">
              <Link
                href={profile?.username ? `/users/${profile.username}` : '#'}
                className="block font-medium text-ink hover:underline"
              >
                {profile?.name ?? profile?.username ?? '不明'}
              </Link>
              {profile?.username && (
                <p className="text-xs text-ink-sub">@{profile.username}</p>
              )}
            </div>
            {isOwn && (
              <span className="ml-auto shrink-0 rounded-full bg-cream px-2.5 py-0.5 text-xs font-medium text-amber-800">
                あなたの記録
              </span>
            )}
          </div>
        </section>

        {/* Review content */}
        <section className="rounded-2xl border border-edge bg-surface p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <RatingBadge rating={review.rating} />
              <span className="text-sm font-medium text-ink">{RATING_LABELS[review.rating]}</span>
            </div>
            {review.visit_date && (
              <span className="shrink-0 text-xs text-ink-sub">{review.visit_date}</span>
            )}
          </div>

          {review.comment && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {review.comment}
            </p>
          )}

          {imageUrl && (
            <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl bg-canvas">
              <Image
                src={imageUrl}
                alt="記録の写真"
                fill
                sizes="(max-width: 448px) 100vw, 400px"
                className="object-cover"
                unoptimized
              />
            </div>
          )}
        </section>

        {/* Edit CTA — own reviews only */}
        {isOwn && (
          <Link
            href={`/records/${review.id}/edit`}
            className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-terra px-6 text-sm font-semibold text-white transition-colors hover:bg-terra-deep"
          >
            この記録を編集
          </Link>
        )}

        {/* Restaurant link */}
        {restaurant && (
          <Link
            href={`/restaurants/${restaurant.id}`}
            className="flex items-center justify-between rounded-2xl border border-edge bg-surface p-4 shadow-sm transition-colors hover:bg-canvas"
          >
            <div className="min-w-0">
              <p className="text-xs text-ink-sub">この店舗を見る</p>
              <p className="truncate font-medium text-ink">{restaurant.name}</p>
              {(restaurant.area || restaurant.genre) && (
                <p className="mt-0.5 text-xs text-ink-sub">
                  {[restaurant.area, restaurant.genre].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 shrink-0 text-ink-sub"
            >
              <path
                fillRule="evenodd"
                d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        )}
      </div>
      <BottomNav />
    </main>
  )
}
