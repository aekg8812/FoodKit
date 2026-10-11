import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────────────────

type FolloweeRow    = { followee_id: string }
type GroupMemberRow = { group_id: string }
type ReviewRow      = {
  id: string
  restaurant_id: string
  rating: number
  comment: string | null
  visit_date: string | null
  created_at: string
  image_path: string | null
  user_id: string
}
type RestaurantRow  = { id: string; name: string; area: string | null; genre: string | null }
type ProfileRow     = { id: string; username: string; name: string | null; avatar_path: string | null }
type GroupRow       = { id: string; name: string }
type RecRow         = {
  restaurant_id: string
  name: string
  area: string | null
  genre: string | null
  personal_score: number
  evidence_count: number
  followed_evidence_count: number
  similar_evidence_count: number
}

// ── Rating chip ────────────────────────────────────────────────────────────

const SHORT_RATING: Record<number, { label: string; bg: string }> = {
  4: { label: '常連になりたい', bg: 'bg-emerald-100 text-emerald-700' },
  3: { label: 'また行きたい',   bg: 'bg-orange-100 text-orange-700' },
  2: { label: '一度で十分',    bg: 'bg-sky-100 text-sky-700' },
  1: { label: '二度と行かない', bg: 'bg-red-100 text-red-600' },
}

function RatingChip({ rating }: { rating: number }) {
  const meta = SHORT_RATING[rating]
  if (!meta) return null
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.bg}`}>
      {meta.label}
    </span>
  )
}

// ── Helper ─────────────────────────────────────────────────────────────────

function evidenceBadgeText(rec: RecRow): string {
  if (rec.similar_evidence_count > 0) {
    return `あなたと好みが近い${rec.similar_evidence_count}人が「また行きたい」`
  }
  if (rec.followed_evidence_count > 0) {
    return `フォロー中の${rec.followed_evidence_count}人が「また行きたい」`
  }
  return `${rec.evidence_count}件の記録から`
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
    unreadResult,
    followeeResult,
    recsResult,
    groupMemberResult,
  ] = await Promise.all([
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
    supabase.rpc('get_personal_recommendations_v2', { p_limit: 4 }),
    supabase.from('group_members').select('group_id').eq('user_id', user.id).limit(4),
  ])

  const unreadCount    = unreadResult.count ?? 0
  const followeeIds    = ((followeeResult.data ?? []) as FolloweeRow[]).map(f => f.followee_id)
  const recs           = ((recsResult.data ?? []) as RecRow[])
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
      <div className="flex items-center justify-between px-5 pt-10 pb-2">
        <div className="w-10" />
        <h1 className="text-base font-bold text-ink">ホーム</h1>
        <Link
          href="/notifications"
          aria-label={`通知${unreadCount > 0 ? `（未読${unreadCount}件）` : ''}`}
          className="relative flex h-10 w-10 items-center justify-center rounded-full"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-terra" aria-hidden="true" />
          )}
        </Link>
      </div>

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <div className="mb-3 px-5">
        <form action="/search/results" method="get">
          <label className="flex items-center gap-3 rounded-2xl border border-edge bg-surface px-4 py-2.5 shadow-sm transition-shadow focus-within:ring-1 focus-within:ring-terra">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
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

      {/* ── 今日のお店 ────────────────────────────────────────────────────── */}
      <div className="mb-4 px-5">
        <Link
          href="/search/today"
          className="relative block overflow-hidden rounded-2xl shadow-sm"
          style={{ background: '#FFF7F0', minHeight: '164px' }}
        >
          {/* Right: food photo (~39%) */}
          <div
            className="absolute inset-y-0 right-0 overflow-hidden"
            style={{ width: '39%' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/landing-hero-food.png"
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: '30% center' }}
              aria-hidden="true"
            />
            {/* Cream gradient — blends photo left edge into card background */}
            <div
              className="absolute inset-y-0 left-0 w-14"
              style={{ background: 'linear-gradient(to right, #FFF7F0, transparent)' }}
              aria-hidden="true"
            />
          </div>

          {/* Photo caption — small/dim, secondary visual only */}
          <p
            className="absolute right-2.5 top-3 z-10 text-right text-[10px] italic leading-snug"
            style={{ color: 'rgba(47,42,39,0.40)' }}
            aria-hidden="true"
          >
            今日は<br />どんなお店に行く？
          </p>

          {/* Left content area (~63%) */}
          <div
            className="relative z-10 flex flex-col justify-between p-4"
            style={{ minHeight: '164px', width: '63%' }}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 0 L9.2 5.8 L15 8 L9.2 10.2 L8 16 L6.8 10.2 L1 8 L6.8 5.8 Z" fill="#F97316" />
                </svg>
                <span className="text-sm font-bold text-ink">今日のお店</span>
              </div>
              <p className="mt-0.5 text-xs text-ink-sub">今の条件に合うお店を探す</p>
            </div>

            {/* Condition chips */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['1人', '友達と', '安く', '近くで', 'ゆっくり'].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-edge bg-white/80 px-2.5 py-0.5 text-[11px] text-ink"
                >
                  {chip}
                </span>
              ))}
            </div>

            {/* CTA — full-width of left column */}
            <div className="mt-3">
              <span className="block rounded-full bg-terra py-2.5 text-center text-sm font-bold text-white">
                条件を設定する ›
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* ── フォロー中の人の最近の記録 ───────────────────────────────────── */}
      <section className="mb-4 px-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">フォロー中の人の最近の記録</h2>
          {reviews.length > 0 && (
            <Link href="/home/following-records" className="text-xs font-medium text-terra">
              もっと見る ›
            </Link>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-5 py-6 text-center">
            <p className="text-sm text-ink-sub">フォロー中の人の記録はまだありません</p>
            {followeeIds.length === 0 && (
              <Link
                href="/mypage/follows/search"
                className="mt-3 inline-flex min-h-9 items-center rounded-xl bg-terra px-4 text-xs font-semibold text-white"
              >
                ユーザーを探す
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {reviews.map((review) => {
              const restaurant  = restaurantMap.get(review.restaurant_id)
              const profile     = profileMap.get(review.user_id)
              const avatarUrl   = profile?.avatar_path
                ? `${supabaseUrl}/storage/v1/object/public/avatars/${profile.avatar_path}`
                : null
              const imageUrl    = review.image_path ? signedUrlMap.get(review.image_path) ?? null : null
              const displayName = profile?.name ?? profile?.username ?? '...'
              const initial     = Array.from(displayName.trim())[0] ?? '?'

              return (
                <Link
                  key={review.id}
                  href={`/records/${review.id}`}
                  className="flex items-center gap-2.5 rounded-2xl border border-edge bg-surface px-3 py-2.5 shadow-sm transition-colors hover:bg-canvas"
                >
                  {/* Avatar only — no label below */}
                  <div className="shrink-0">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={displayName}
                        width={36}
                        height={36}
                        className="h-9 w-9 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-edge text-sm font-semibold text-ink-sub">
                        {initial}
                      </span>
                    )}
                  </div>

                  {/* Food thumbnail (only when signed URL exists) */}
                  {imageUrl && (
                    <Image
                      src={imageUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      unoptimized
                    />
                  )}

                  {/* Text area: username / restaurant + chip / comment */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink-sub">{displayName}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      {restaurant && (
                        <span className="truncate text-sm font-bold text-ink">{restaurant.name}</span>
                      )}
                      <RatingChip rating={review.rating} />
                    </div>
                    {review.comment && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-ink-sub">{review.comment}</p>
                    )}
                  </div>

                  {/* Chevron */}
                  <span className="shrink-0 text-sm text-ink-sub" aria-hidden="true">›</span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ── あなたへのおすすめ ────────────────────────────────────────────── */}
      <section className="mb-4 px-5">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-ink">あなたへのおすすめ</h2>
            <p className="mt-0.5 text-xs text-ink-sub">好みが近い人の記録をもとにおすすめしています</p>
          </div>
          {recs.length > 0 && (
            <Link href="/home/recommendations" className="mt-0.5 shrink-0 text-xs font-medium text-terra">
              もっと見る ›
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
                className="inline-flex min-h-9 items-center rounded-xl bg-terra px-4 text-xs font-semibold text-white"
              >
                ユーザーを探す
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {recs.slice(0, 4).map((rec) => (
              <Link
                key={rec.restaurant_id}
                href={`/restaurants/${rec.restaurant_id}`}
                className="flex flex-col overflow-hidden rounded-2xl border border-edge bg-surface p-2.5 shadow-sm transition-opacity hover:opacity-90"
              >
                {/* Restaurant name + genre */}
                <p className="line-clamp-2 text-sm font-bold leading-snug text-ink">{rec.name}</p>
                {rec.genre && (
                  <p className="mt-0.5 truncate text-xs text-ink-sub">{rec.genre}</p>
                )}

                {/* Spacer pushes evidence box to bottom */}
                <div className="min-h-[6px] flex-1" />

                {/* Evidence box */}
                <div className="mt-2 rounded-lg bg-terra/10 px-2 py-1.5">
                  <div className="flex items-start gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
                      <circle cx="9" cy="7" r="3" />
                      <path d="M3 21v-2a5 5 0 0 1 5-5h2" />
                      <circle cx="17" cy="9" r="3" />
                      <path d="M21 21v-2a5 5 0 0 0-5-5h-2" />
                    </svg>
                    <p className="text-[10px] leading-snug text-terra">{evidenceBadgeText(rec)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── グループで店を探す ────────────────────────────────────────────── */}
      <section className="mb-4 px-5">
        <div className="mb-2">
          <h2 className="text-base font-bold text-ink">グループで店を探す</h2>
          <p className="mt-0.5 text-xs text-ink-sub">みんなの好みに合うお店を見つける</p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-edge bg-surface px-3 py-2.5 shadow-sm whitespace-nowrap"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="7" r="3" />
                <path d="M3 21v-2a5 5 0 0 1 5-5h2" />
                <circle cx="17" cy="9" r="3" />
                <path d="M21 21v-2a5 5 0 0 0-5-5h-2" />
              </svg>
              <span className="text-xs font-medium text-ink">{group.name}</span>
              <span className="text-xs text-ink-sub" aria-hidden="true">›</span>
            </Link>
          ))}
          <Link
            href="/groups"
            className="shrink-0 rounded-xl border border-terra px-3 py-2.5 text-xs font-bold text-terra whitespace-nowrap"
          >
            グループを見る ›
          </Link>
        </div>
      </section>

      <BottomNav />
    </main>
  )
}
