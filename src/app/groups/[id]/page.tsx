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

type GroupDetailPageProps = {
  params: Promise<{ id: string }>
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

  // Step 2: fetch profiles by ID (safe 2-query — avoids PostgREST view join)
  const profilesResult =
    memberUserIds.length > 0
      ? await supabase
          .from('user_public_profiles')
          .select('id, username, name, avatar_path')
          .in('id', memberUserIds)
      : { data: [] as ProfileRow[], error: null }

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 pb-20">
      <div className="mx-auto max-w-md space-y-4">
        <Suspense>
          <BackButton fallbackHref="/groups" label="← グループ一覧" />
        </Suspense>

        {/* Group header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-sub">グループ</p>
            <h1 className="break-words text-xl font-bold text-ink">{group.name}</h1>
          </div>
          <GroupMenu
            groupId={group.id}
            groupName={group.name}
            inviteCode={group.invite_code}
            currentUserId={user.id}
            members={members}
            isCurrentMember={isCurrentMember}
          />
        </div>

        {/* Members card */}
        <section className="rounded-2xl border border-edge bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">
              メンバー{' '}
              <span className="text-ink-sub">
                ({memberCount}人 · {partyLabel})
              </span>
            </h2>
            <Link href={`/groups/${groupId}/members`} className="text-xs text-terra hover:underline">
              全員を見る
            </Link>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {memberUserIds.slice(0, 6).map((uid) => {
              const profile = profileMap.get(uid)
              const avatarPath = profile?.avatar_path
              const avatarUrl = avatarPath
                ? `${supabaseUrl}/storage/v1/object/public/avatars/${avatarPath}`
                : null
              const initial =
                Array.from((profile?.name ?? profile?.username ?? '?').trim())[0] ?? '?'
              return (
                <Link
                  key={uid}
                  href={profile?.username ? `/users/${profile.username}` : '#'}
                  className="flex shrink-0 flex-col items-center gap-1"
                >
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={profile?.name ?? profile?.username ?? ''}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream text-sm font-semibold text-amber-800">
                      {initial}
                    </span>
                  )}
                  <span className="max-w-[48px] truncate text-[10px] text-ink-sub">
                    {profile?.name ?? profile?.username ?? ''}
                  </span>
                </Link>
              )
            })}
            {memberCount > 6 && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas text-xs text-ink-sub">
                +{memberCount - 6}
              </span>
            )}
          </div>

          <div className="mt-3">
            <Link
              href={`/groups/${groupId}/invite`}
              className="inline-flex min-h-9 items-center rounded-full border border-terra px-4 text-xs font-semibold text-terra transition-colors hover:bg-cream"
            >
              招待する
            </Link>
          </div>
        </section>

        {/* Preference summary */}
        <section className="rounded-2xl border border-edge bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">グループの食の好み</h2>
          {validMemberCount === 0 ? (
            <p className="mt-3 text-sm text-ink-sub">
              好みを設定済みのメンバーがいません（5枚以上設定で有効）
            </p>
          ) : prefCards.length === 0 ? (
            <p className="mt-3 text-sm text-ink-sub">まだ共通の好みがありません</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-ink-sub">{validMemberCount}人中の選択状況</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {prefCards.slice(0, 8).map((card) => (
                  <span
                    key={card.sort_order}
                    className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-amber-800"
                  >
                    {card.label}
                    <span className="ml-1 text-amber-600">
                      {card.selected_member_count}/{validMemberCount}
                    </span>
                  </span>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Recommendations */}
        <section className="rounded-2xl border border-edge bg-surface p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-ink">おすすめ</h2>
          <p className="mt-1 text-xs text-ink-sub">
            グループの好みが近い人の記録をもとに提案します
          </p>
          <div className="mt-4 space-y-3">
            <Link
              href={`/groups/${groupId}/recommendations`}
              className="flex min-h-11 w-full items-center justify-between rounded-xl border border-edge bg-canvas px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface"
            >
              <span>条件なしでおすすめを見る</span>
              <span className="text-ink-sub" aria-hidden="true">
                →
              </span>
            </Link>
            <Link
              href={`/groups/${groupId}/recommendations/conditions`}
              className="flex min-h-11 w-full items-center justify-between rounded-xl bg-terra px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <span>条件を指定して探す</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  )
}
