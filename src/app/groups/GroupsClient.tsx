'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import Card from '@/components/ui/Card'
import ValueTypeBadge from '@/components/ValueTypeBadge'

export type GroupRow = { id: string; name: string; invite_code: string }

export type MemberRow = {
  group_id: string
  user_id: string
  // group_members.user_id → users.id (FK on group_members → outbound join → single object)
  users: { id: string; name: string } | null
}

export type MemberProfileRow = { user_id: string; main_value_type: string | null }

interface Props {
  currentUserId: string
  groups: GroupRow[]
  members: MemberRow[]
  memberProfiles: MemberProfileRow[]
}

export default function GroupsClient({ currentUserId, groups, members, memberProfiles }: Props) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const profileMap = useMemo(
    () => new Map(memberProfiles.map((p) => [p.user_id, p.main_value_type])),
    [memberProfiles],
  )

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      // Clipboard API unavailable (non-HTTPS / non-localhost). Code is visible on screen.
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <div className="mx-auto max-w-md">
        <h1 className="mb-6 text-2xl font-bold text-ink">グループ</h1>

        {groups.length > 0 ? (
          <div className="space-y-6">
            {groups.map((group) => {
              const groupMembers = members.filter((member) => member.group_id === group.id)

              return (
                <section key={group.id} className="space-y-4">
                  <Card className="p-6">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-sub">
                      グループ
                    </p>
                    <p className="text-2xl font-bold text-ink">{group.name}</p>
                  </Card>

                  <Card className="p-6">
                    <h2 className="mb-4 text-base font-semibold text-ink">メンバー</h2>
                    <ul className="divide-y divide-edge">
                      {groupMembers.map((member) => (
                        <li key={member.user_id} className="py-3 first:pt-0 last:pb-0">
                          <p className="text-sm font-medium text-ink">
                            {member.users?.name ?? '（名前なし）'}
                            {member.user_id === currentUserId && (
                              <span className="ml-1.5 text-xs font-normal text-ink-sub">
                                (あなた)
                              </span>
                            )}
                          </p>
                          <div className="mt-1.5">
                            <ValueTypeBadge type={profileMap.get(member.user_id)} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>

                  <Card className="p-6">
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
                        {copiedCode === group.invite_code ? 'コピー済み ✓' : 'コピー'}
                      </button>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <h2 className="mb-3 text-base font-semibold text-ink">店舗</h2>
                    <Link
                      href="/restaurants"
                      className="inline-flex min-h-[44px] items-center rounded-full bg-terra px-5 text-sm font-medium text-white transition-all duration-150 hover:bg-terra-deep motion-safe:active:scale-[0.98]"
                    >
                      グループの店舗を見る
                    </Link>
                  </Card>
                </section>
              )
            })}
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
