import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import RatingBadge from '@/components/RatingBadge'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'

type ReviewRow = {
  id: string
  rating: number
  restaurant_id: string
  image_path: string | null
  comment: string | null
  visit_date: string | null
  created_at: string
  restaurants: { id: string; name: string } | null
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export default async function UserRecordsPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const supabase = await createClient()

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser()
  if (!viewer) redirect('/login')

  const state = await getUserState(supabase, viewer)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data: profileData, error: profileError } = await supabase
    .from('user_public_profiles')
    .select('id, username, name')
    .ilike('username', escapeLikePattern(username))
    .limit(1)
    .maybeSingle()

  if (profileError)
    throw new Error(`UserRecordsPage: profile query failed: ${profileError.message}`)
  if (!profileData) notFound()

  const profile = profileData as { id: string; username: string; name: string }

  const { data: rawReviews, error: reviewsError } = await supabase
    .from('reviews')
    .select(
      'id, rating, restaurant_id, image_path, comment, visit_date, created_at, restaurants(id, name)',
    )
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (reviewsError)
    throw new Error(`UserRecordsPage: reviews query failed: ${reviewsError.message}`)

  const reviewRows = (rawReviews ?? []) as unknown as ReviewRow[]

  const imagePaths = [
    ...new Set(reviewRows.map((r) => r.image_path).filter((p): p is string => Boolean(p))),
  ]
  const signedImagesResult = imagePaths.length
    ? await supabase.storage.from('review-images').createSignedUrls(imagePaths, 60 * 60)
    : { data: [], error: null }
  const signedImageUrls = new Map<string, string>()
  for (const item of signedImagesResult.data ?? []) {
    if (item.path && !item.error && item.signedUrl) signedImageUrls.set(item.path, item.signedUrl)
  }

  const displayName = profile.name ?? profile.username
  const isSelf = viewer.id === profile.id

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <Suspense>
          <BackButton fallbackHref={`/users/${profile.username}`} label="" />
        </Suspense>
        <h1 className="text-base font-bold text-ink">
          {isSelf ? 'あなたの記録' : `${displayName}の記録`}
        </h1>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-md px-4 space-y-4">

        {reviewRows.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface p-6 text-center">
            <p className="text-sm text-ink-sub">まだ記録がありません</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {reviewRows.map((row) => {
              const imageUrl = row.image_path ? (signedImageUrls.get(row.image_path) ?? null) : null
              return (
                <li key={row.id}>
                  <Link
                    href={`/records/${row.id}`}
                    className="block rounded-2xl border border-edge bg-surface p-4 shadow-sm transition-colors hover:bg-canvas"
                  >
                    <div className="flex items-start gap-3">
                      {imageUrl ? (
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-canvas">
                          <Image
                            src={imageUrl}
                            alt={row.restaurants?.name ?? '記録の写真'}
                            fill
                            sizes="64px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">
                          {row.restaurants?.name ?? '店舗情報なし'}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <RatingBadge rating={row.rating} />
                          {row.visit_date && (
                            <span className="text-xs text-ink-sub">{row.visit_date}</span>
                          )}
                        </div>
                        {row.comment && (
                          <p className="mt-1 line-clamp-2 text-sm text-ink-sub">{row.comment}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
