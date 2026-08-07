'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import Card from '@/components/ui/Card'
import ValueTypeBadge from '@/components/ValueTypeBadge'

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
  group: GroupRow | null
  members: MemberRow[]
  memberProfiles: MemberProfileRow[]
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'オーナー',
  member: 'メンバー',
}

export default function GroupsClient({ currentUserId, group, members, memberProfiles }: Props) {
  const [copied, setCopied] = useState(false)

  const profileMap = useMemo(
    () => new Map(memberProfiles.map((p) => [p.user_id, p.main_value_type])),
    [memberProfiles],
  )

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
        <h1 className="mb-6 text-2xl font-bold text-ink">グループ</h1>

        {group ? (
          <div className="space-y-4">
            {/* グループ名 */}
            <Card as="section" className="p-6">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-sub">
                グループ
              </p>
              <p className="text-2xl font-bold text-ink">{group.name}</p>
            </Card>

            {/* メンバー一覧 */}
            <Card as="section" className="p-6">
              <h2 className="mb-4 text-base font-semibold text-ink">メンバー</h2>
              <ul className="divide-y divide-edge">
                {members.map((m) => (
                  <li key={m.user_id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium text-ink">
                      {m.users?.name ?? '（名前なし）'}
                      {m.user_id === currentUserId && (
                        <span className="ml-1.5 text-xs font-normal text-ink-sub">(あなた)</span>
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

            {/* 招待コード */}
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

            {/* 店舗一覧への導線 */}
            <Card as="section" className="p-6">
              <h2 className="mb-3 text-base font-semibold text-ink">店舗</h2>
              <Link
                href="/restaurants"
                className="inline-flex min-h-[44px] items-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-all duration-150 hover:bg-terra-deep motion-safe:active:scale-[0.98]"
              >
                グループの店舗を見る
              </Link>
            </Card>
          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-sm text-ink-sub">グループ情報が見つかりません</p>
          </Card>
        )}
      </div>
      <BottomNav />
    </main>
  )
}
