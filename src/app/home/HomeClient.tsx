'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { type MainValueType, VALUE_TYPE_LABEL } from '@/lib/onboarding/classifyValueType'
import LogoutButton from '@/components/LogoutButton'

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

const RATING_LABELS: Record<number, string> = {
  4: '常連になりたい',
  3: '機会があればまた行きたい',
  2: '一度行けば十分',
  1: '二度と行かない',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'オーナー',
  member: 'メンバー',
}

function valueTypeLabel(type: string | null | undefined): string {
  if (!type) return '未設定'
  return VALUE_TYPE_LABEL[type as MainValueType] ?? type
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
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-2xl font-semibold text-zinc-950">ホーム</h1>

        {/* Tab bar */}
        <div className="mb-6 flex gap-2">
          {(['mypage', 'group'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={
                activeTab === tab
                  ? 'rounded-full bg-zinc-950 px-5 py-2 text-sm font-medium text-white'
                  : 'rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50'
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
            <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-zinc-950">価値観プロファイル</h2>
              {profile ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">タイプ</dt>
                    <dd className="font-medium text-zinc-950">
                      {valueTypeLabel(profile.main_value_type)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">診断精度</dt>
                    <dd className="text-zinc-950">{confidencePct}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">プロフィール完成度</dt>
                    <dd className="text-zinc-950">{profile.profile_completion}%</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-zinc-500">価値観診断が未完了です</p>
              )}
            </section>

            {/* B-2: My reviews */}
            <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-zinc-950">投稿したレビュー</h2>
              {myReviews.length === 0 ? (
                <p className="text-sm text-zinc-500">まだレビューを投稿していません</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {myReviews.map((review) => (
                    <li key={review.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={`/restaurants/${review.restaurant_id}`}
                        className="block hover:opacity-70"
                      >
                        <p className="font-medium text-zinc-950">
                          {review.restaurants?.name ?? '（店舗情報なし）'}
                        </p>
                        <p className="mt-0.5 text-sm text-zinc-700">
                          {review.rating}&nbsp;
                          <span className="text-zinc-500">{RATING_LABELS[review.rating]}</span>
                        </p>
                        {review.comment && (
                          <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
                            {review.comment}
                          </p>
                        )}
                        {review.visit_date && (
                          <p className="mt-1 text-xs text-zinc-400">{review.visit_date}</p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* B-3: My restaurants */}
            <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-zinc-950">登録した店舗</h2>
              {myRestaurants.length === 0 ? (
                <div>
                  <p className="mb-3 text-sm text-zinc-500">まだ店舗を登録していません</p>
                  <Link
                    href="/restaurants/new"
                    className="inline-block rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                  >
                    店舗を登録
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {myRestaurants.map((r) => (
                    <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                      <Link href={`/restaurants/${r.id}`} className="block hover:opacity-70">
                        <p className="font-medium text-zinc-950">{r.name}</p>
                        {(r.area || r.genre) && (
                          <p className="mt-0.5 text-sm text-zinc-500">
                            {[r.area, r.genre].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* B-4: Group name + shortcut to group tab */}
            <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-2 text-base font-semibold text-zinc-950">所属グループ</h2>
              {group ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-950">{group.name}</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('group')}
                    className="text-sm text-zinc-500 hover:text-zinc-700"
                  >
                    グループを見る →
                  </button>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">グループ情報が見つかりません</p>
              )}
            </section>

            {/* B-5: Account info + logout */}
            <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-zinc-950">アカウント</h2>
              <dl className="mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">名前</dt>
                  <dd className="text-zinc-950">{userData.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">メール</dt>
                  <dd className="text-zinc-950">{userData.email}</dd>
                </div>
              </dl>
              <LogoutButton />
            </section>
          </div>
        )}

        {/* ── Group Tab ── */}
        {activeTab === 'group' && (
          <div className="space-y-4">
            {group ? (
              <>
                {/* C-1: Group name */}
                <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                    グループ
                  </p>
                  <p className="text-2xl font-semibold text-zinc-950">{group.name}</p>
                </section>

                {/* C-2: Member list */}
                <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-base font-semibold text-zinc-950">メンバー</h2>
                  <ul className="divide-y divide-zinc-100">
                    {members.map((m) => (
                      <li
                        key={m.user_id}
                        className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-zinc-950">
                            {m.users?.name ?? '（名前なし）'}
                            {m.user_id === currentUserId && (
                              <span className="ml-1.5 text-xs font-normal text-zinc-400">
                                (あなた)
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {valueTypeLabel(profileMap.get(m.user_id))}
                            {' · '}
                            {ROLE_LABELS[m.role] ?? m.role}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* C-3: Invite code */}
                <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-3 text-base font-semibold text-zinc-950">招待コード</h2>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 rounded-md bg-zinc-100 px-3 py-2 font-mono text-sm text-zinc-950">
                      {group.invite_code}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(group.invite_code)}
                      className="shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                      {copied ? 'コピーしました' : 'コピー'}
                    </button>
                  </div>
                </section>

                {/* C-4: Link to restaurants */}
                <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-3 text-base font-semibold text-zinc-950">店舗</h2>
                  <Link
                    href="/restaurants"
                    className="inline-block rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                  >
                    グループの店舗を見る
                  </Link>
                </section>
              </>
            ) : (
              <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
                <p className="text-sm text-zinc-500">グループ情報が見つかりません</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
