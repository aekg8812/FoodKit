import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import GroupMenu, { type GroupMenuMember } from '@/components/groups/GroupMenu'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'

type GroupRow = {
  id: string
  name: string
  invite_code: string
}

type MemberIdRow = {
  user_id: string
}

type ProfileRow = {
  id: string
  username: string
  name: string | null
  avatar_path: string | null
}

type PreferenceCardRow = {
  label: string
  description: string | null
  image_path: string | null
  sort_order: number
  selected_member_count: number
  valid_member_count: number
}

type ReviewRow = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  created_at: string
  image_path: string | null
  user_id: string
  restaurant_id: string
  restaurants: { id: string; name: string; genre: string | null } | null
}

type GroupDetailPageProps = {
  params: Promise<{ id: string }>
}

const RATING_CHIP: Record<number, { label: string; bg: string; text: string }> = {
  4: { label: '常連になりたい', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  3: { label: 'また行きたい', bg: 'bg-pink-50', text: 'text-[#E05C7A]' },
  2: { label: '一度で十分', bg: 'bg-sky-50', text: 'text-sky-600' },
  1: { label: '二度と行かない', bg: 'bg-zinc-100', text: 'text-zinc-600' },
}

function memberCountToPartyLabel(count: number): string {
  if (count <= 1) return '1人'
  if (count === 2) return '2人'
  if (count <= 4) return '3〜4人'
  return '5人以上'
}

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { id: groupId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // Step 1: group + member IDs + preference summary in parallel
  const [groupResult, memberIdsResult, prefSummaryResult] = await Promise.all([
    supabase.from('groups').select('id, name, invite_code').eq('id', groupId).maybeSingle(),
    supabase.from('group_members').select('user_id').eq('group_id', groupId),
    supabase.rpc('get_group_preference_summary', { p_group_id: groupId }),
  ])

  if (groupResult.error) {
    console.error('GroupDetailPage: failed to load group', groupResult.error)
    throw new Error('グループ情報を読み込めませんでした。')
  }
  if (!groupResult.data) notFound()

  if (memberIdsResult.error) {
    console.error('GroupDetailPage: failed to load member ids', memberIdsResult.error)
    throw new Error('メンバー情報を読み込めませんでした。')
  }

  const group = groupResult.data as GroupRow
  const memberIdRows = (memberIdsResult.data ?? []) as MemberIdRow[]
  const memberUserIds = memberIdRows.map((m) => m.user_id)

  // Step 2: fetch profiles + recent member reviews in parallel
  const [profilesResult, memberReviewsResult] = await Promise.all([
    memberUserIds.length > 0
      ? supabase
          .from('user_public_profiles')
          .select('id, username, name, avatar_path')
          .in('id', memberUserIds)
      : { data: [] as ProfileRow[], error: null },
    memberUserIds.length > 0
      ? supabase
          .from('reviews')
          .select('id, rating, comment, visit_date, created_at, image_path, user_id, restaurant_id, restaurants(id, name, genre)')
          .in('user_id', memberUserIds)
          .order('created_at', { ascending: false })
          .limit(5)
      : { data: [] as ReviewRow[], error: null },
  ])

  if (profilesResult.error) {
    console.error('GroupDetailPage: failed to load profiles', profilesResult.error)
    throw new Error('メンバー情報を読み込めませんでした。')
  }

  const profileMap = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  )

  const isCurrentMember = memberUserIds.includes(user.id)

  const members: GroupMenuMember[] = memberUserIds.map((uid) => ({
    id: uid,
    name: profileMap.get(uid)?.name ?? '（名前なし）',
    valueType: null,
  }))

  const prefCards = (prefSummaryResult.data ?? []) as PreferenceCardRow[]
  const validMemberCount = prefCards[0]?.valid_member_count ?? 0
  const memberCount = memberUserIds.length
  const partyLabel = memberCountToPartyLabel(memberCount)

  // Common preference chips = cards selected by all or most members
  const commonCards = prefCards.filter(
    (c) => validMemberCount > 0 && c.selected_member_count >= validMemberCount,
  ).slice(0, 5)

  const memberReviews = (memberReviewsResult.data ?? []) as unknown as ReviewRow[]

  // Signed URLs for review images
  const reviewImagePaths = [
    ...new Set(memberReviews.map((r) => r.image_path).filter((p): p is string => Boolean(p))),
  ]
  const signedImagesResult = reviewImagePaths.length
    ? await supabase.storage.from('review-images').createSignedUrls(reviewImagePaths, 3600)
    : { data: [], error: null }
  const signedImageUrls = new Map<string, string>()
  for (const item of signedImagesResult.data ?? []) {
    if (item.path && !item.error && item.signedUrl) signedImageUrls.set(item.path, item.signedUrl)
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref="/groups" label="" />
        </Suspense>
        <h1 className="flex-1 truncate px-2 text-center text-base font-bold text-ink">
          {group.name}
        </h1>
        <GroupMenu
          groupId={group.id}
          groupName={group.name}
          inviteCode={group.invite_code}
          currentUserId={user.id}
          members={members}
          isCurrentMember={isCurrentMember}
        />
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 pt-4">

        {/* Group info card */}
        <section className="rounded-2xl border border-edge bg-surface p-4">
          <div className="flex items-center gap-4">
            {/* Group icon placeholder */}
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#F3E5D8]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">{group.name}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-sub">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {memberCount}人のグループ
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href={`/groups/${groupId}/members`}
              className="flex h-[44px] items-center justify-center gap-2 rounded-xl border border-terra text-sm font-bold text-terra"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              メンバーを見る
            </Link>
            <Link
              href={`/groups/${groupId}/invite`}
              className="flex h-[44px] items-center justify-center gap-2 rounded-xl border border-terra text-sm font-bold text-terra"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              招待する
            </Link>
          </div>
        </section>

        {/* Group preference summary */}
        <section className="rounded-2xl border border-edge bg-surface p-4">
          <h2 className="font-bold text-ink">このグループの好み</h2>
          <p className="mt-0.5 text-xs text-ink-sub">みんなの記録や好みから見た傾向</p>

          {validMemberCount === 0 ? (
            <p className="mt-3 text-sm text-ink-sub">
              好みを設定済みのメンバーがいません（5枚以上設定で有効）
            </p>
          ) : commonCards.length === 0 ? (
            <p className="mt-3 text-sm text-ink-sub">まだ共通の好みがありません</p>
          ) : (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold text-ink-sub">みんなに共通</p>
              <div className="flex flex-wrap gap-2">
                {commonCards.map((card) => (
                  <span
                    key={card.sort_order}
                    className="rounded-full border border-terra/30 bg-terra/10 px-3 py-1 text-xs font-medium text-terra"
                  >
                    {card.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Find a restaurant section */}
        <section className="rounded-2xl border border-edge bg-surface p-4">
          <h2 className="font-bold text-ink">このメンバーで店を探す</h2>
          <p className="mt-0.5 text-xs text-ink-sub">みんなの好みから、お店を提案します</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-edge bg-canvas px-3 py-1 text-xs text-ink">
              {partyLabel}
            </span>
          </div>

          <Link
            href={`/groups/${groupId}/recommendations`}
            className="mt-3 flex h-[48px] w-full items-center justify-center rounded-xl bg-terra text-sm font-bold text-white"
          >
            おすすめを見る ›
          </Link>
          <Link
            href={`/groups/${groupId}/recommendations/conditions`}
            className="mt-2 flex h-[40px] w-full items-center justify-center text-sm font-medium text-terra"
          >
            条件を変更 ›
          </Link>
        </section>

        {/* Member recent records */}
        {memberReviews.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-ink">メンバーの最近の記録</h2>
              <Link
                href={`/groups/${groupId}/recommendations`}
                className="text-xs text-terra"
              >
                もっと見る ›
              </Link>
            </div>

            <div className="space-y-3">
              {memberReviews.slice(0, 3).map((review) => {
                const author = profileMap.get(review.user_id)
                const avatarUrl = author?.avatar_path
                  ? supabase.storage.from('avatars').getPublicUrl(author.avatar_path).data.publicUrl
                  : null
                const authorInitial = Array.from((author?.name ?? author?.username ?? '?').trim())[0] ?? '?'
                const imgUrl = review.image_path ? signedImageUrls.get(review.image_path) ?? null : null
                const chip = RATING_CHIP[review.rating]

                return (
                  <Link
                    key={review.id}
                    href={`/records/${review.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-edge bg-surface p-3 hover:bg-canvas"
                  >
                    {/* Author avatar */}
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={author?.name ?? ''}
                        width={36}
                        height={36}
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-edge text-sm font-bold text-ink-sub">
                        {authorInitial}
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-ink-sub">{author?.name ?? author?.username ?? ''}さん</p>
                      <p className="font-bold text-terra leading-tight">
                        {review.restaurants?.name ?? '不明な店舗'}
                      </p>
                      {chip && (
                        <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${chip.bg} ${chip.text}`}>
                          {chip.label}
                        </span>
                      )}
                      {review.comment && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-ink-sub">{review.comment}</p>
                      )}
                    </div>

                    {/* Review thumbnail */}
                    {imgUrl ? (
                      <div className="relative h-[56px] w-[56px] shrink-0 overflow-hidden rounded-xl">
                        <Image
                          src={imgUrl}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                          <line x1="6" y1="1" x2="6" y2="4" />
                          <line x1="10" y1="1" x2="10" y2="4" />
                          <line x1="14" y1="1" x2="14" y2="4" />
                        </svg>
                      </div>
                    )}

                    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                      <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          </section>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
