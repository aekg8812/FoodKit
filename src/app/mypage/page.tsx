import Image from 'next/image'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import RatingBadge from '@/components/RatingBadge'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type RecentReviewRow = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  image_path: string | null
  restaurants: { id: string; name: string } | null
}

type PreferenceCardRow = {
  preference_cards: { label: string; sort_order: number } | null
}

export default async function MypagePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [profileResult, reviewCountResult, recentReviewsResult, preferenceCardsResult, followCountsResult] =
    await Promise.all([
      supabase
        .from('user_public_profiles')
        .select('id, username, name, avatar_path, updated_at')
        .eq('id', user.id)
        .single(),
      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('reviews')
        .select('id, rating, comment, visit_date, image_path, restaurants(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(3),
      supabase
        .from('user_preference_cards')
        .select('preference_cards(label, sort_order)')
        .eq('user_id', user.id),
      supabase.rpc('get_user_follow_counts', { p_user_id: user.id }),
    ])

  if (profileResult.error) {
    throw new Error(`MypagePage: failed to load profile: ${profileResult.error.message}`)
  }

  const profile = profileResult.data
  const reviewCount = reviewCountResult.count ?? 0
  const recentRows = (recentReviewsResult.data ?? []) as unknown as RecentReviewRow[]
  const followCounts = followCountsResult.data?.[0] ?? { following_count: 0, follower_count: 0 }

  const preferenceCards = (preferenceCardsResult.data ?? [])
    .map((row) => {
      const pc = (row as unknown as PreferenceCardRow).preference_cards
      return pc ?? null
    })
    .filter((c): c is { label: string; sort_order: number } => c !== null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, 5)

  // Signed URLs for recent review images
  const imagePaths = [
    ...new Set(
      recentRows
        .map((r) => r.image_path)
        .filter((p): p is string => Boolean(p)),
    ),
  ]
  const signedImagesResult = imagePaths.length
    ? await supabase.storage.from('review-images').createSignedUrls(imagePaths, 60 * 60)
    : { data: [], error: null }

  const signedImageUrls = new Map<string, string | null>()
  for (const s of signedImagesResult.data ?? []) {
    if (s.path) signedImageUrls.set(s.path, s.signedUrl)
  }

  const avatarRaw = profile.avatar_path
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null
  const avatarUrl =
    avatarRaw && profile.updated_at
      ? `${avatarRaw}?v=${encodeURIComponent(profile.updated_at)}`
      : avatarRaw

  const initial: string = (profile.name ?? profile.username ?? '?').trim().charAt(0) || '?'

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Profile header */}
      <div className="bg-surface px-6 pt-10 pb-6 border-b border-edge">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={profile.name ?? profile.username ?? ''}
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover shrink-0"
                unoptimized
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-cream text-2xl font-bold text-amber-800">
                {initial}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-lg text-ink">{profile.name ?? profile.username}</p>
              {profile.username && (
                <p className="truncate text-sm text-ink-sub">@{profile.username}</p>
              )}
              <p className="mt-1 text-sm text-ink-sub">
                記録 <span className="font-semibold text-ink tabular-nums">{reviewCount}</span>件
              </p>
            </div>
          </div>

          <div className="mt-4">
            <Link
              href="/mypage/profile/edit"
              className="inline-flex min-h-[40px] items-center rounded-full border border-edge bg-canvas px-5 text-sm font-medium text-ink transition-colors hover:bg-surface"
            >
              プロフィールを編集
            </Link>
          </div>

          <div className="mt-4 flex gap-4 text-sm">
            <Link href="/mypage/follows" className="hover:underline">
              <span className="font-semibold text-ink tabular-nums">{Number(followCounts.following_count)}</span>
              <span className="ml-1 text-ink-sub">フォロー中</span>
            </Link>
            <Link href="/mypage/follows" className="hover:underline">
              <span className="font-semibold text-ink tabular-nums">{Number(followCounts.follower_count)}</span>
              <span className="ml-1 text-ink-sub">フォロワー</span>
            </Link>
          </div>

        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-5 space-y-6">
        {/* Recent records */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink">最近の記録</h2>
            <Link
              href="/mypage/records"
              className="text-sm text-terra hover:text-terra-deep font-medium"
            >
              すべて見る
            </Link>
          </div>

          {recentRows.length === 0 ? (
            <div className="rounded-2xl border border-edge bg-surface p-6 text-center">
              <p className="text-sm text-ink-sub">まだ記録がありません</p>
              <Link
                href="/record"
                className="mt-3 inline-flex min-h-[40px] items-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-colors hover:bg-terra-deep"
              >
                記録する
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {recentRows.map((review) => {
                const imgUrl = review.image_path
                  ? signedImageUrls.get(review.image_path) ?? null
                  : null
                return (
                  <li key={review.id}>
                    <div className="rounded-2xl border border-edge bg-surface overflow-hidden">
                      {/* Restaurant name → restaurant detail */}
                      {review.restaurants ? (
                        <div className="border-b border-edge px-4 pt-3 pb-2">
                          <Link
                            href={`/restaurants/${review.restaurants.id}`}
                            className="inline-flex min-h-[28px] items-center gap-1 text-sm font-semibold text-terra hover:text-terra-deep"
                          >
                            {review.restaurants.name}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
                              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                            </svg>
                          </Link>
                        </div>
                      ) : (
                        <div className="border-b border-edge px-4 pt-3 pb-2">
                          <p className="text-sm font-semibold text-ink-sub">店舗情報なし</p>
                        </div>
                      )}

                      {/* Record body → record detail */}
                      <Link
                        href={`/records/${review.id}`}
                        className="flex items-center gap-3 p-4 transition-colors hover:bg-canvas"
                      >
                        {imgUrl ? (
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-canvas">
                            <Image
                              src={imgUrl}
                              alt={review.restaurants?.name ?? ''}
                              fill
                              sizes="56px"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="h-14 w-14 shrink-0 rounded-lg bg-canvas" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <RatingBadge rating={review.rating} />
                          </div>
                          {review.comment && (
                            <p className="mt-1 line-clamp-1 text-xs text-ink-sub">{review.comment}</p>
                          )}
                          {review.visit_date && (
                            <p className="mt-0.5 text-xs text-ink-sub">{review.visit_date}</p>
                          )}
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-ink-sub">
                          <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Preference cards preview */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink">あなたの好み</h2>
            <Link
              href="/mypage/food-preferences"
              className="text-sm text-terra hover:text-terra-deep font-medium"
            >
              {preferenceCards.length > 0 ? 'すべて見る / 編集' : '設定する'}
            </Link>
          </div>

          {preferenceCards.length === 0 ? (
            <div className="rounded-2xl border border-edge bg-surface p-6 text-center">
              <p className="text-sm text-ink-sub">まだ好みが設定されていません</p>
              <Link
                href="/mypage/food-preferences/edit"
                className="mt-3 inline-flex min-h-[40px] items-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-colors hover:bg-terra-deep"
              >
                好みを設定する
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {preferenceCards.map((card, i) => (
                <span
                  key={i}
                  className="rounded-full border border-edge bg-surface px-3 py-1.5 text-sm font-medium text-ink"
                >
                  {card.label}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* Follow / Follower */}
        <section>
          <Link
            href="/mypage/follows"
            className="flex items-center justify-between rounded-2xl border border-edge bg-surface px-4 py-4 transition-colors hover:bg-canvas"
          >
            <div>
              <p className="font-semibold text-ink">フォロー・フォロワー</p>
              <p className="mt-0.5 text-xs text-ink-sub">
                フォロー中 {Number(followCounts.following_count)}人 · フォロワー {Number(followCounts.follower_count)}人
              </p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-ink-sub">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </Link>
        </section>

        {/* Settings */}
        <section>
          <Link
            href="/settings"
            className="flex items-center justify-between rounded-2xl border border-edge bg-surface px-4 py-4 transition-colors hover:bg-canvas"
          >
            <p className="font-semibold text-ink">設定</p>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-ink-sub">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </Link>
        </section>
      </div>

      <BottomNav />
    </main>
  )
}
