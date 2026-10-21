import Link from 'next/link'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'

type GroupRow = {
  id: string
  name: string
}

type PrefCardRow = {
  label: string
  sort_order: number
}

export default async function GroupsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/groups', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data: groupData, error: groupError } = await supabase
    .from('groups')
    .select('id, name')
    .order('created_at', { ascending: true })

  const groups = groupError ? [] : ((groupData ?? []) as GroupRow[])
  const groupIds = groups.map(g => g.id)

  // Fetch member counts + preference chips for each group in parallel
  const [membersResult, prefResults] = await Promise.all([
    groupIds.length > 0
      ? supabase.from('group_members').select('group_id, user_id').in('group_id', groupIds)
      : { data: [] },
    groupIds.length > 0
      ? Promise.all(
          groupIds.map(id =>
            supabase
              .rpc('get_group_preference_summary', { p_group_id: id })
              .then(r => ({ id, cards: ((r.data ?? []) as PrefCardRow[]).slice(0, 3) }))
          )
        )
      : Promise.resolve([]),
  ])

  const membersByGroup = new Map<string, number>()
  for (const row of (membersResult.data ?? []) as { group_id: string; user_id: string }[]) {
    membersByGroup.set(row.group_id, (membersByGroup.get(row.group_id) ?? 0) + 1)
  }

  const prefByGroup = new Map<string, PrefCardRow[]>()
  for (const r of prefResults) {
    prefByGroup.set(r.id, r.cards)
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="px-4 pt-14 pb-3 text-center">
        <h1 className="text-xl font-black text-ink">グループ</h1>
        <p className="mt-0.5 text-xs text-ink-sub">一緒にお店を探すグループ</p>
      </div>

      <div className="mx-auto max-w-md px-4 space-y-4">
        {/* Add group button */}
        <Link
          href="/groups/join"
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-terra text-base font-bold text-terra"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          グループを追加
        </Link>

        {/* Groups list */}
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center">
            <p className="text-sm text-ink-sub">まだ参加しているグループはありません</p>
            <p className="mt-1 text-xs text-ink-sub">「グループを追加」から作成または参加できます</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ink">参加中のグループ</h2>
              <span className="text-sm text-ink-sub">{groups.length}件</span>
            </div>

            <div className="space-y-3">
              {groups.map(group => {
                const memberCount = membersByGroup.get(group.id) ?? 0
                const chips = prefByGroup.get(group.id) ?? []

                return (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-edge bg-surface p-4 hover:bg-canvas"
                  >
                    {/* Group icon placeholder */}
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F3E5D8]">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-ink">{group.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-sub">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        {memberCount}人のグループ
                      </p>
                      {chips.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {chips.map(c => (
                            <span
                              key={c.sort_order}
                              className="rounded-full border border-edge bg-canvas px-2.5 py-0.5 text-[11px] text-ink-sub"
                            >
                              {c.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                      <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
