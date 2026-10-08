import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import RatingBadge from '@/components/RatingBadge'

// ── Types ─────────────────────────────────────────────────────────────────

type FolloweeRow   = { followee_id: string }
type GroupMemberRow = { group_id: string }
type ReviewRow     = {
  id: string
  restaurant_id: string
  rating: number
  comment: string | null
  visit_date: string | null
  created_at: string
  image_path: string | null
  user_id: string
}
type RestaurantRow = { id: string; name: string; area: string | null; genre: string | null }
type ProfileRow    = { id: string; username: string; name: string | null; avatar_path: string | null }
type GroupRow      = { id: string; name: string }
type RecRow        = {
  restaurant_id: string
  name: string
  area: string | null
  genre: string | null
  personal_score: number
  evidence_count: number
  followed_evidence_count: number
  similar_evidence_count: number
}

// ── Helper ─────────────────────────────────────────────────────────────────

function recommendationReason(rec: RecRow): string {
  if (rec.followed_evidence_count > 0 && rec.similar_evidence_count > 0) {
    return 'フォロー中・好みが近い人の記録から'
  }
  if (rec.followed_evidence_count > 0) return 'フォロー中の人の記録から'
  return '好みが近い人の記録から'
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // ── Phase 1: parallel independent fetches ───────────────────────────────
  const [
    userResult,
    unreadResult,
    followeeResult,
    recsResult,
    groupMemberResult,
  ] = await Promise.all([
    supabase.from('users').select('name').eq('id', user.id).single(),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_user_id', user.id)
      .is('read_at', null),
    supabase
      .from('follows')
      .select('followee_id')
      .eq('follower_id', user.id)
      .eq('status', 'accepted'),
    supabase.rpc('get_personal_recommendations_v2', { p_limit: 5 }),
    supabase.from('group_members').select('group_id').eq('user_id', user.id).limit(4),
  ])

  const userName      = userResult.data?.name ?? null
  const unreadCount   = unreadResult.count ?? 0
  const followeeIds   = ((followeeResult.data ?? []) as FolloweeRow[]).map(f => f.followee_id)
  const recs          = ((recsResult.data ?? []) as RecRow[])
  const groupMemberIds = ((groupMemberResult.data ?? []) as GroupMemberRow[]).map(g => g.group_id)

  // ── Phase 2: dependent on followees + group IDs ─────────────────────────
  const [recentReviewsResult, groupDetailsResult] = await Promise.all([
    followeeIds.length > 0
      ? supabase
          .from('reviews')
          .select('id, restaurant_id, rating, comment, visit_date, created_at, image_path, user_id')
          .in('user_id', followeeIds)
          .order('created_at', { ascending: false })
          .limit(3)
      : { data: [] as ReviewRow[], error: null },
    groupMemberIds.length > 0
      ? supabase.from('groups').select('id, name').in('id', groupMemberIds)
      : { data: [] as GroupRow[], error: null },
  ])

  const reviews = ((recentReviewsResult.data ?? []) as ReviewRow[])
  const groups  = ((groupDetailsResult.data ?? []) as GroupRow[])

  // ── Phase 3: dependent on reviews ───────────────────────────────────────
  const reviewRestaurantIds = [...new Set(reviews.map(r => r.restaurant_id))]
  const reviewAuthorIds     = [...new Set(reviews.map(r => r.user_id))]

  const [reviewRestaurantsResult, reviewProfilesResult] = await Promise.all([
    reviewRestaurantIds.length > 0
      ? supabase.from('restaurants').select('id, name, area, genre').in('id', reviewRestaurantIds)
      : { data: [] as RestaurantRow[], error: null },
    reviewAuthorIds.length > 0
      ? supabase.from('user_public_profiles').select('id, username, name, avatar_path').in('id', reviewAuthorIds)
      : { data: [] as ProfileRow[], error: null },
  ])

  const restaurantMap = new Map(
    ((reviewRestaurantsResult.data ?? []) as RestaurantRow[]).map(r => [r.id, r])
  )
  const profileMap = new Map(
    ((reviewProfilesResult.data ?? []) as ProfileRow[]).map(p => [p.id, p])
  )

  // ── Phase 4: sign review image URLs ─────────────────────────────────────
  const imagePaths = reviews.flatMap(r => r.image_path ? [r.image_path] : [])
  const signedResult = imagePaths.length > 0
    ? await supabase.storage.from('review-images').createSignedUrls(imagePaths, 3600)
    : { data: [], error: null }

  const signedUrlMap = new Map<string, string>()
  for (const s of signedResult.data ?? []) {
    if (s.path && s.signedUrl && !s.error) signedUrlMap.set(s.path, s.signedUrl)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return (
    <main className="min-h-screen bg-canvas pb-24">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-5 pb-4 pt-12">
        <div>
          <p className="text-xl font-bold text-ink">
            {userName ? `こんにちは、${userName}さん` : 'こんにちは'}
          </p>
          <p className="mt-0.5 text-sm text-ink-sub">今日は何が食べたい?</p>
        </div>
        <Link
          href="/notifications"
          aria-label={`通知${unreadCount > 0 ? `（未読${unreadCount}件）` : ''}`}
          className="relative mt-1 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-surface"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-terra text-[9px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
      </div>

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <div className="mb-5 px-5">
        <form action="/search/results" method="get">
          <label className="flex items-center gap-3 rounded-full border border-edge bg-surface px-4 py-3 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-terra">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              name="q"
              placeholder="店名・ジャンル・エリアで検索"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-sub"
              autoComplete="off"
            />
          </label>
        </form>
      </div>

      {/* ── Today's restaurant ───────────────────────────────────────────── */}
      <div className="mb-6 px-5">
        <Link
          href="/search/today"
          className="flex items-center gap-4 overflow-hidden rounded-2xl p-4 shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)' }}
        >
          <div className="flex-1">
            <p className="font-semibold text-white">今日のお店を探す</p>
            <p className="mt-0.5 text-xs text-white/80">予算・移動手段・雰囲気で絞り込む</p>
          </div>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
            <line x1="6" y1="1" x2="6" y2="4"/>
            <line x1="10" y1="1" x2="10" y2="4"/>
            <line x1="14" y1="1" x2="14" y2="4"/>
          </svg>
        </Link>
      </div>

      {/* ── Following recent records ─────────────────────────────────────── */}
      <section className="mb-6 px-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">フォロー中の人の最近の記録</h2>
          {reviews.length > 0 && (
            <Link href="/home/following-records" className="text-xs text-terra hover:underline">
              もっと見る →
            </Link>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-5 py-6 text-center">
            <p className="text-sm text-ink-sub">フォロー中の人の記録はまだありません</p>
            {followeeIds.length === 0 && (
              <Link
                href="/mypage/follows/search"
                className="mt-3 inline-flex min-h-9 items-center rounded-full bg-terra px-4 text-xs font-semibold text-white"
              >
                ユーザーを探す
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {reviews.map(review => {
              const restaurant = restaurantMap.get(review.restaurant_id)
              const profile    = profileMap.get(review.user_id)
              const avatarUrl  = profile?.avatar_path
                ? `${supabaseUrl}/storage/v1/object/public/avatars/${profile.avatar_path}`
                : null
              const imageUrl   = review.image_path ? signedUrlMap.get(review.image_path) ?? null : null
              const initial    = Array.from((profile?.name ?? profile?.username ?? '?').trim())[0] ?? '?'

              return (
                <li key={review.id} className="rounded-2xl border border-edge bg-surface p-4 shadow-sm">
                  {/* Author row */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={profile?.username ? `/users/${profile.username}` : '#'}
                      className="shrink-0"
                    >
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt={profile?.name ?? ''}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-sm font-semibold text-amber-800">
                          {initial}
                        </span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={profile?.username ? `/users/${profile.username}` : '#'}
                        className="truncate text-sm font-medium text-ink hover:underline"
                      >
                        {profile?.name ?? profile?.username ?? '（名前なし）'}
                      </Link>
                    </div>
                    <RatingBadge rating={review.rating} />
                  </div>

                  {/* Restaurant */}
                  {restaurant && (
                    <Link
                      href={`/restaurants/${review.restaurant_id}`}
                      className="mt-2 block truncate text-sm font-semibold text-terra hover:underline"
                    >
                      {restaurant.name}
                      {restaurant.genre && (
                        <span className="ml-1.5 text-xs font-normal text-ink-sub">{restaurant.genre}</span>
                      )}
                    </Link>
                  )}

                  {/* Comment preview */}
                  {review.comment && (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-sub">{review.comment}</p>
                  )}

                  {/* Review image */}
                  {imageUrl && (
                    <div className="mt-2 overflow-hidden rounded-xl">
                      <Image
                        src={imageUrl}
                        alt="記録の写真"
                        width={400}
                        height={200}
                        className="h-32 w-full object-cover"
                        unoptimized
                      />
                    </div>
                  )}

                  {/* Detail link */}
                  <Link
                    href={`/records/${review.id}`}
                    className="mt-2 block text-xs text-terra hover:underline"
                  >
                    記録の詳細を見る →
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── Personal recommendations ─────────────────────────────────────── */}
      <section className="mb-6 px-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">あなたへのおすすめ</h2>
          {recs.length > 0 && (
            <Link href="/home/recommendations" className="text-xs text-terra hover:underline">
              もっと見る →
            </Link>
          )}
        </div>

        {recs.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-5 py-6 text-center">
            <p className="text-sm text-ink-sub">おすすめを作るための記録がまだ足りません</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link
                href="/mypage/food-preferences/edit"
                className="inline-flex min-h-9 items-center rounded-full border border-terra px-4 text-xs font-semibold text-terra"
              >
                好みを設定する
              </Link>
              <Link
                href="/mypage/follows/search"
                className="inline-flex min-h-9 items-center rounded-full bg-terra px-4 text-xs font-semibold text-white"
              >
                ユーザーを探す
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {recs.map(rec => (
              <li key={rec.restaurant_id}>
                <Link
                  href={`/restaurants/${rec.restaurant_id}`}
                  className="flex items-center justify-between rounded-2xl border border-edge bg-surface px-4 py-3 shadow-sm transition-colors hover:bg-canvas"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{rec.name}</p>
                    {(rec.genre ?? rec.area) && (
                      <p className="mt-0.5 truncate text-xs text-ink-sub">
                        {[rec.genre, rec.area].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-ink-sub">{recommendationReason(rec)}</p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className="text-sm font-bold text-terra">
                      {Math.round(rec.personal_score * 50)}点
                    </p>
                    <p className="text-[10px] text-ink-sub">{rec.evidence_count}件の記録</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Groups ───────────────────────────────────────────────────────── */}
      <section className="mb-6 px-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">グループ</h2>
          <Link href="/groups" className="text-xs text-terra hover:underline">
            すべて見る →
          </Link>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-5 py-6 text-center">
            <p className="text-sm text-ink-sub">まだグループに参加していません</p>
            <Link
              href="/groups"
              className="mt-3 inline-flex min-h-9 items-center rounded-full bg-terra px-4 text-xs font-semibold text-white"
            >
              グループを見る
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-surface">
            {groups.map(group => (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className="flex min-h-[52px] items-center justify-between px-4 py-3 transition-colors hover:bg-canvas"
                >
                  <span className="text-sm font-medium text-ink">{group.name}</span>
                  <span className="text-xs text-ink-sub" aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BottomNav />
    </main>
  )
}
