import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'

type MemberIdRow = {
  user_id: string
  joined_at: string
}

type ProfileRow = {
  id: string
  username: string
  name: string | null
  avatar_path: string | null
}

type PreferenceCardRow = {
  label: string
  sort_order: number
}

type GroupMembersPageProps = {
  params: Promise<{ id: string }>
}

export default async function GroupMembersPage({ params }: GroupMembersPageProps) {
  const { id: groupId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // Step 1: group + member IDs + group preference summary in parallel
  const [groupResult, membersResult, prefSummaryResult] = await Promise.all([
    supabase.from('groups').select('id, name').eq('id', groupId).maybeSingle(),
    supabase
      .from('group_members')
      .select('user_id, joined_at')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true }),
    supabase.rpc('get_group_preference_summary', { p_group_id: groupId }),
  ])

  if (groupResult.error) throw new Error('グループ情報を読み込めませんでした。')
  if (!groupResult.data) notFound()
  if (membersResult.error) throw new Error('メンバー情報を読み込めませんでした。')

  const group = groupResult.data as { id: string; name: string }
  const memberIdRows = (membersResult.data ?? []) as MemberIdRow[]
  const memberUserIds = memberIdRows.map((m) => m.user_id)

  // Step 2: fetch profiles
  const profilesResult =
    memberUserIds.length > 0
      ? await supabase
          .from('user_public_profiles')
          .select('id, username, name, avatar_path')
          .in('id', memberUserIds)
      : { data: [] as ProfileRow[], error: null }

  if (profilesResult.error) throw new Error('メンバー情報を読み込めませんでした。')

  const profileMap = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  )

  // Step 3: fetch each member's top preference cards
  const memberPrefResults = memberUserIds.length > 0
    ? await Promise.all(
        memberUserIds.map((uid) =>
          supabase.rpc('get_user_preference_cards_public', { p_user_id: uid }).then((r) => ({
            uid,
            cards: ((r.data ?? []) as PreferenceCardRow[]).slice(0, 3),
          })),
        ),
      )
    : []

  const memberPrefMap = new Map(memberPrefResults.map((r) => [r.uid, r.cards]))

  // Group common preference chips (top 3 from group summary)
  const groupPrefCards = ((prefSummaryResult.data ?? []) as { label: string; sort_order: number }[]).slice(0, 3)

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref={`/groups/${groupId}`} label="" />
        </Suspense>
        <h1 className="flex-1 text-center text-base font-bold text-ink">メンバー</h1>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 pt-4">

        {/* Group summary card */}
        <section className="rounded-2xl border border-edge bg-surface p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F3E5D8]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">{group.name}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-sub">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {memberIdRows.length}人のグループ
              </p>
              {groupPrefCards.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {groupPrefCards.map((card) => (
                    <span
                      key={card.sort_order}
                      className="rounded-full bg-terra/10 px-2.5 py-0.5 text-[11px] font-medium text-terra"
                    >
                      {card.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Member list */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-ink">メンバー一覧</h2>
            <span className="text-sm text-ink-sub">{memberIdRows.length}人</span>
          </div>

          {memberIdRows.length === 0 ? (
            <p className="rounded-2xl border border-edge bg-surface px-5 py-8 text-center text-sm text-ink-sub">
              メンバーがいません
            </p>
          ) : (
            <div className="space-y-3">
              {memberIdRows.map((m) => {
                const profile = profileMap.get(m.user_id)
                const avatarUrl = profile?.avatar_path
                  ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
                  : null
                const initial = Array.from((profile?.name ?? profile?.username ?? '?').trim())[0] ?? '?'
                const isSelf = m.user_id === user.id
                const prefCards = memberPrefMap.get(m.user_id) ?? []

                return (
                  <Link
                    key={m.user_id}
                    href={profile?.username ? `/users/${profile.username}` : '#'}
                    className="flex items-center gap-3 rounded-2xl border border-edge bg-surface p-4 hover:bg-canvas"
                  >
                    {/* Avatar */}
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={profile?.name ?? profile?.username ?? ''}
                        width={50}
                        height={50}
                        className="h-[50px] w-[50px] shrink-0 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-edge text-lg font-bold text-ink-sub">
                        {initial}
                      </span>
                    )}

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold text-ink">
                          {profile?.name ?? profile?.username ?? '（名前なし）'}
                        </p>
                        {isSelf && (
                          <span className="shrink-0 rounded-full bg-terra px-2 py-0.5 text-[11px] font-bold text-white">
                            あなた
                          </span>
                        )}
                      </div>
                      {profile?.username && (
                        <p className="text-xs text-ink-sub">@{profile.username}</p>
                      )}
                      {prefCards.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {prefCards.map((card) => (
                            <span
                              key={card.sort_order}
                              className="rounded-full border border-edge bg-canvas px-2.5 py-0.5 text-[11px] text-ink-sub"
                            >
                              {card.label}
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
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
