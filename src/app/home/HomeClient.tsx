'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import LogoutButton from '@/components/LogoutButton'
import BottomNav from '@/components/BottomNav'
import Card from '@/components/ui/Card'
import RatingBadge, { RATING_LABELS } from '@/components/RatingBadge'
import ValueTypeBadge from '@/components/ValueTypeBadge'

export type UserRow = { name: string; email: string }

export type ValueProfileRow = {
  main_value_type: string | null
  // PostgreSQL numeric(4,3) may arrive as string from the Supabase client.
  confidence: number | string
  profile_completion: number
}

export type MyReviewRow = {
  id: string
  rating: number
  comment: string | null
  visit_date: string | null
  created_at: string
  restaurant_id: string
  // reviews.restaurant_id → restaurants.id (FK on reviews → outbound join → single object)
  restaurants: { id: string; name: string } | null
}

export type MyRestaurantRow = {
  id: string
  name: string
  area: string | null
  genre: string | null
  created_at: string
}

export type GroupRow = { id: string; name: string; invite_code: string }

export type MemberRow = {
  user_id: string
  role: string
  // group_members.user_id → users.id (FK on group_members → outbound join → single object)
  users: { id: string; name: string } | null
}

export type MemberProfileRow = { user_id: string; main_value_type: string | null }

interface Props {
  currentUserId: string
  userData: UserRow
  profile: ValueProfileRow | null
  myReviews: MyReviewRow[]
  myRestaurants: MyRestaurantRow[]
  group: GroupRow | null
  members: MemberRow[]
  memberProfiles: MemberProfileRow[]
}

type Tab = 'mypage' | 'group'

const ROLE_LABELS: Record<string, string> = {
  owner: 'オーナー',
  member: 'メンバー',
}

export default function HomeClient({
  currentUserId,
  userData,
  profile,
  myReviews,
  myRestaurants,
  group,
  members,
  memberProfiles,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('mypage')
  const [copied, setCopied] = useState(false)

  const profileMap = useMemo(
    () => new Map(memberProfiles.map((p) => [p.user_id, p.main_value_type])),
    [memberProfiles],
  )

  // numeric(4,3) may arrive as string "0.400" — Number() handles both
  const confidencePct = profile ? Math.round(Number(profile.confidence) * 100) : null

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable (non-HTTPS / non-localhost). Code is visible on screen.
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-2xl font-bold text-ink">ホーム</h1>

        {/* Tab bar */}
        <div className="mb-6 flex gap-2">
          {(['mypage', 'group'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={
                activeTab === tab
                  ? 'min-h-[44px] rounded-full bg-terra px-5 py-2 text-sm font-medium text-white transition-all duration-150'
                  : 'min-h-[44px] rounded-full border border-edge px-5 py-2 text-sm font-medium text-ink transition-all duration-150 hover:bg-surface motion-safe:active:scale-[0.98]'
              }
            >
              {tab === 'mypage' ? 'マイページ' : 'グループ'}
            </button>
          ))}
        </div>

        {/* ── My Page Tab ── */}
        {activeTab === 'mypage' && (
          <div className="space-y-4">
            {/* B-1: Value profile */}
            <Card as="section" className="p-6">
              <h2 className="mb-5 text-base font-semibold text-ink">価値観プロファイル</h2>
              {profile ? (
                <div className="space-y-5">
                  {/* Value type badge */}
                  <div>
                    <p className="mb-2 text-xs font-medium text-ink-sub">タイプ</p>
                    <ValueTypeBadge type={profile.main_value_type} />
                  </div>

                  {/* Confidence bar */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-xs font-medium text-ink-sub">診断精度</p>
                      <p className="text-xs tabular-nums text-ink-sub">{confidencePct}%</p>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
                      <div
                        className="h-2 rounded-full bg-terra"
                        style={{ width: `${confidencePct}%` }}
                      />
                    </div>
                  </div>

                  {/* Profile completion bar */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-xs font-medium text-ink-sub">プロフィール完成度</p>
                      <p className="text-xs tabular-nums text-ink-sub">{profile.profile_completion}%</p>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-canvas">
                      <div
                        className="h-2 rounded-full bg-honey"
                        style={{ width: `${profile.profile_completion}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink-sub">価値観診断が未完了です</p>
              )}
            </Card>

            {/* B-2: My reviews */}
            <Card as="section" className="p-6">
              <h2 className="mb-4 text-base font-semibold text-ink">投稿したレビュー</h2>
              {myReviews.length === 0 ? (
                <div className="py-2 text-center">
                  <p className="mb-1.5 text-2xl" aria-hidden="true">📝</p>
                  <p className="text-sm text-ink-sub">まだレビューを投稿していません</p>
                </div>
              ) : (
                <ul className="divide-y divide-edge">
                  {myReviews.map((review) => (
                    <li key={review.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={`/restaurants/${review.restaurant_id}`}
                        className="block hover:opacity-70 transition-opacity duration-150"
                      >
                        <p className="font-medium text-ink">
                          {review.restaurants?.name ?? '（店舗情報なし）'}
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                          <RatingBadge rating={review.rating} />
                          <span className="text-ink-sub">{RATING_LABELS[review.rating]}</span>
                        </p>
                        {review.comment && (
                          <p className="mt-1.5 line-clamp-2 text-sm text-ink-sub">
                            {review.comment}
                          </p>
                        )}
                        {review.visit_date && (
                          <p className="mt-1 text-xs text-ink-sub">{review.visit_date}</p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* B-3: My restaurants */}
            <Card as="section" className="p-6">
              <h2 className="mb-4 text-base font-semibold text-ink">登録した店舗</h2>
              {myRestaurants.length === 0 ? (
                <div className="py-2 text-center">
                  <p className="mb-1.5 text-2xl" aria-hidden="true">🍽️</p>
                  <p className="mb-4 text-sm text-ink-sub">まだ店舗を登録していません</p>
                  <Link
                    href="/restaurants/new"
                    className="inline-block rounded-full bg-terra px-5 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-terra-deep motion-safe:active:scale-[0.98]"
                  >
                    店舗を登録
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-edge">
                  {myRestaurants.map((r) => (
                    <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                      <Link href={`/restaurants/${r.id}`} className="block hover:opacity-70 transition-opacity duration-150">
                        <p className="font-medium text-ink">{r.name}</p>
                        {(r.area || r.genre) && (
                          <p className="mt-0.5 text-sm text-ink-sub">
                            {[r.area, r.genre].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* B-4: Group name + shortcut to group tab */}
            <Card as="section" className="p-6">
              <h2 className="mb-2 text-base font-semibold text-ink">所属グループ</h2>
              {group ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-ink">{group.name}</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('group')}
                    className="shrink-0 text-sm text-terra transition-colors duration-150 hover:text-terra-deep"
                  >
                    グループを見る →
                  </button>
                </div>
              ) : (
                <p className="text-sm text-ink-sub">グループ情報が見つかりません</p>
              )}
            </Card>

            {/* B-5: Account info + logout */}
            <Card as="section" className="p-6">
              <h2 className="mb-4 text-base font-semibold text-ink">アカウント</h2>
              <dl className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-ink-sub">名前</dt>
                  <dd className="text-right text-ink">{userData.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-ink-sub">メール</dt>
                  <dd className="truncate text-right text-ink">{userData.email}</dd>
                </div>
              </dl>
              <LogoutButton />
            </Card>
          </div>
        )}

        {/* ── Group Tab ── */}
        {activeTab === 'group' && (
          <div className="space-y-4">
            {group ? (
              <>
                {/* C-1: Group name */}
                <Card as="section" className="p-6">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-sub">
                    グループ
                  </p>
                  <p className="text-2xl font-bold text-ink">{group.name}</p>
                </Card>

                {/* C-2: Member list */}
                <Card as="section" className="p-6">
                  <h2 className="mb-4 text-base font-semibold text-ink">メンバー</h2>
                  <ul className="divide-y divide-edge">
                    {members.map((m) => (
                      <li
                        key={m.user_id}
                        className="py-3 first:pt-0 last:pb-0"
                      >
                        <p className="text-sm font-medium text-ink">
                          {m.users?.name ?? '（名前なし）'}
                          {m.user_id === currentUserId && (
                            <span className="ml-1.5 text-xs font-normal text-ink-sub">
                              (あなた)
                            </span>
                          )}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <ValueTypeBadge type={profileMap.get(m.user_id)} />
                          <span className="text-xs text-ink-sub">
                            {ROLE_LABELS[m.role] ?? m.role}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* C-3: Invite code */}
                <Card as="section" className="p-6">
                  <h2 className="mb-3 text-base font-semibold text-ink">招待コード</h2>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 rounded-xl bg-canvas px-3 py-2 font-mono text-sm text-ink">
                      {group.invite_code}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(group.invite_code)}
                      className="min-h-[44px] shrink-0 rounded-full border border-edge px-4 py-2 text-sm font-medium text-ink transition-all duration-150 hover:bg-canvas motion-safe:active:scale-[0.98]"
                    >
                      {copied ? 'コピー済み ✓' : 'コピー'}
                    </button>
                  </div>
                </Card>

                {/* C-4: Link to restaurants */}
                <Card as="section" className="p-6">
                  <h2 className="mb-3 text-base font-semibold text-ink">店舗</h2>
                  <Link
                    href="/restaurants"
                    className="inline-flex min-h-[44px] items-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-all duration-150 hover:bg-terra-deep motion-safe:active:scale-[0.98]"
                  >
                    グループの店舗を見る
                  </Link>
                </Card>
              </>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-sm text-ink-sub">グループ情報が見つかりません</p>
              </Card>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  )
}
