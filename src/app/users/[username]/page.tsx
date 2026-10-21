import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import ProfileActions, { type FollowRelationship } from './ProfileActions'

type PublicProfileRow = {
  id: string
  username: string
  name: string
  avatar_path: string | null
  updated_at: string | null
}

type FollowRow = {
  follower_id: string
  followee_id: string
}

type FollowCountsRow = {
  following_count: number
  follower_count: number
}

type PreferenceCardRow = {
  label: string
  description: string | null
  image_path: string | null
  sort_order: number
}

type ReviewRow = {
  id: string
  rating: number
  restaurant_id: string
  image_path: string | null
  comment: string | null
  visit_date: string | null
  created_at: string
  restaurants: { id: string; name: string; genre: string | null; area: string | null } | null
}

const RATING_CHIP: Record<number, { label: string; bg: string; text: string; border: string }> = {
  4: { label: '常連になりたい', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  3: { label: 'また行きたい', bg: 'bg-pink-50', text: 'text-[#E05C7A]', border: 'border-pink-300' },
  2: { label: '一度で十分', bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-300' },
  1: { label: '二度と行かない', bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-300' },
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function getRelationship(
  viewerId: string,
  profileUserId: string,
  follows: FollowRow[],
): FollowRelationship {
  if (viewerId === profileUserId) return 'self'
  const outgoing = follows.some((f) => f.follower_id === viewerId && f.followee_id === profileUserId)
  const incoming = follows.some((f) => f.follower_id === profileUserId && f.followee_id === viewerId)
  if (outgoing && incoming) return 'mutual'
  if (outgoing) return 'outgoing'
  if (incoming) return 'incoming'
  return 'none'
}

export default async function UserProfilePage({
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
    .select('id, username, name, avatar_path, updated_at')
    .ilike('username', escapeLikePattern(username))
    .limit(1)
    .maybeSingle()

  if (profileError) throw new Error(`UserProfilePage: profile query failed: ${profileError.message}`)
  if (!profileData) notFound()

  const profile = profileData as PublicProfileRow
  const isSelf = viewer.id === profile.id

  const followsQuery = isSelf
    ? Promise.resolve({ data: [] as FollowRow[], error: null })
    : supabase
        .from('follows')
        .select('follower_id, followee_id')
        .in('follower_id', [viewer.id, profile.id])
        .in('followee_id', [viewer.id, profile.id])
        .eq('status', 'accepted')

  const [followCountsResult, prefCardsResult, followsResult, reviewsResult, reviewCountResult] =
    await Promise.all([
      supabase.rpc('get_user_follow_counts', { p_user_id: profile.id }),
      supabase.rpc('get_user_preference_cards_public', { p_user_id: profile.id }),
      followsQuery,
      supabase
        .from('reviews')
        .select('id, rating, restaurant_id, image_path, comment, visit_date, created_at, restaurants(id, name, genre, area)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id),
    ])

  if (reviewsResult.error) throw new Error(`UserProfilePage: reviews query failed: ${reviewsResult.error.message}`)
  if (followCountsResult.error) throw new Error(`UserProfilePage: follow counts failed: ${followCountsResult.error.message}`)

  const reviewRows = (reviewsResult.data ?? []) as unknown as ReviewRow[]
  const reviewCount = reviewCountResult.count ?? 0

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

  const publicAvatarUrl = profile.avatar_path
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null
  const avatarUrl =
    publicAvatarUrl && profile.updated_at
      ? `${publicAvatarUrl}?v=${encodeURIComponent(profile.updated_at)}`
      : publicAvatarUrl

  const relationship = getRelationship(
    viewer.id,
    profile.id,
    (followsResult.data ?? []) as FollowRow[],
  )

  const followCountsRow = (followCountsResult.data as unknown as FollowCountsRow[] | null)?.[0]
  const followingCount = Number(followCountsRow?.following_count ?? 0)
  const followerCount = Number(followCountsRow?.follower_count ?? 0)

  const prefCards = (prefCardsResult.data ?? []) as PreferenceCardRow[]

  const initial = Array.from((profile.name ?? profile.username ?? '?').trim())[0] ?? '?'
  const displayName = profile.name ?? profile.username ?? ''

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref="/home" label="" />
        </Suspense>
        <h1 className="flex-1 text-center text-base font-bold text-ink">プロフィール</h1>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-md">
        {/* Profile section */}
        <section className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={80}
                height={80}
                className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-edge"
                unoptimized
              />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-edge text-2xl font-bold text-ink-sub ring-2 ring-edge">
                {initial}
              </span>
            )}

            {/* Name + follow button + username */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-lg font-bold leading-tight text-ink">
                  {displayName}
                </p>
                {!isSelf && (
                  <div className="shrink-0">
                    <ProfileActions
                      viewerId={viewer.id}
                      profileUserId={profile.id}
                      initialRelationship={relationship}
                    />
                  </div>
                )}
              </div>
              <p className="mt-0.5 text-sm text-ink-sub">@{profile.username}</p>
            </div>
          </div>
        </section>

        {/* Stats row */}
        <div className="mx-4 mb-4 flex divide-x divide-edge overflow-hidden rounded-2xl border border-edge bg-surface">
          <div className="flex flex-1 flex-col items-center py-3">
            <span className="text-xl font-black tabular-nums text-ink">{reviewCount}</span>
            <span className="text-xs text-ink-sub">記録</span>
          </div>
          <div className="flex flex-1 flex-col items-center py-3">
            <span className="text-xl font-black tabular-nums text-ink">{followingCount}</span>
            <span className="text-xs text-ink-sub">フォロー</span>
          </div>
          <div className="flex flex-1 flex-col items-center py-3">
            <span className="text-xl font-black tabular-nums text-ink">{followerCount}</span>
            <span className="text-xs text-ink-sub">フォロワー</span>
          </div>
        </div>

        {/* Preference cards */}
        <section className="mx-4 mb-4 rounded-2xl border border-edge bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{displayName}さんの好み</h2>
            {prefCards.length > 0 && (
              <Link
                href={`/users/${profile.username}/preferences`}
                className="text-xs text-terra"
              >
                すべて見る ›
              </Link>
            )}
          </div>
          {prefCards.length === 0 ? (
            <p className="text-sm text-ink-sub">まだ好みが設定されていません</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {prefCards.slice(0, 5).map((card) => (
                <span
                  key={card.sort_order}
                  className="rounded-full bg-terra/10 px-3 py-1 text-xs font-medium text-terra"
                >
                  {card.label}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Recent records */}
        <section className="mx-4 mb-4 rounded-2xl border border-edge bg-surface">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <h2 className="text-sm font-semibold text-ink">最近の記録</h2>
            {reviewCount > 0 && (
              <Link
                href={`/users/${profile.username}/records`}
                className="text-xs text-terra"
              >
                すべて見る ›
              </Link>
            )}
          </div>

          {reviewRows.length === 0 ? (
            <p className="px-4 pb-5 text-center text-sm text-ink-sub">まだ記録がありません</p>
          ) : (
            <div className="divide-y divide-edge">
              {reviewRows.map((row) => {
                const chip = RATING_CHIP[row.rating]
                const imgUrl = row.image_path ? signedImageUrls.get(row.image_path) ?? null : null
                const dateStr = row.visit_date
                  ? formatDate(row.visit_date)
                  : formatDate(row.created_at)

                return (
                  <Link
                    key={row.id}
                    href={`/records/${row.id}`}
                    className="flex items-start gap-3 p-4 hover:bg-canvas"
                  >
                    {/* Thumbnail */}
                    {imgUrl ? (
                      <div className="relative h-[70px] w-[70px] shrink-0 overflow-hidden rounded-xl">
                        <Image
                          src={imgUrl}
                          alt={row.restaurants?.name ?? ''}
                          fill
                          sizes="70px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                          <line x1="6" y1="1" x2="6" y2="4" />
                          <line x1="10" y1="1" x2="10" y2="4" />
                          <line x1="14" y1="1" x2="14" y2="4" />
                        </svg>
                      </div>
                    )}

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold leading-tight text-ink">
                        {row.restaurants?.name ?? '不明な店舗'}
                      </p>
                      {(row.restaurants?.genre || row.restaurants?.area) && (
                        <p className="mt-0.5 text-xs text-ink-sub">
                          {[row.restaurants?.genre, row.restaurants?.area].filter(Boolean).join('・')}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-2">
                        {chip && (
                          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${chip.bg} ${chip.text} ${chip.border}`}>
                            {chip.label}
                          </span>
                        )}
                        <span className="text-xs text-ink-sub">{dateStr}</span>
                      </div>
                      {row.comment && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-sub">
                          {row.comment}
                        </p>
                      )}
                    </div>

                    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="mt-1 shrink-0 text-ink-sub" aria-hidden="true">
                      <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </main>
  )
}
