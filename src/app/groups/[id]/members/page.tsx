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

  // Step 1: group + member IDs (ordered by join date)
  const [groupResult, membersResult] = await Promise.all([
    supabase.from('groups').select('id, name').eq('id', groupId).maybeSingle(),
    supabase
      .from('group_members')
      .select('user_id, joined_at')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true }),
  ])

  if (groupResult.error) throw new Error('グループ情報を読み込めませんでした。')
  if (!groupResult.data) notFound()
  if (membersResult.error) throw new Error('メンバー情報を読み込めませんでした。')

  const memberIdRows = (membersResult.data ?? []) as MemberIdRow[]
  const memberUserIds = memberIdRows.map((m) => m.user_id)

  // Step 2: fetch profiles by ID (safe 2-query — avoids PostgREST view join)
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <Suspense>
          <BackButton fallbackHref={`/groups/${groupId}`} label="" />
        </Suspense>
        <h1 className="text-base font-bold text-ink">メンバー ({memberIdRows.length}人)</h1>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-md px-4 space-y-4">

        {memberIdRows.length === 0 ? (
          <p className="rounded-2xl border border-edge bg-surface px-5 py-8 text-center text-sm text-ink-sub">
            メンバーがいません
          </p>
        ) : (
          <ul className="divide-y divide-edge rounded-2xl border border-edge bg-surface overflow-hidden">
            {memberIdRows.map((m) => {
              const profile = profileMap.get(m.user_id)
              const avatarPath = profile?.avatar_path
              const avatarUrl = avatarPath
                ? `${supabaseUrl}/storage/v1/object/public/avatars/${avatarPath}`
                : null
              const initial =
                Array.from((profile?.name ?? profile?.username ?? '?').trim())[0] ?? '?'
              const isSelf = m.user_id === user.id

              return (
                <li key={m.user_id}>
                  <Link
                    href={profile?.username ? `/users/${profile.username}` : '#'}
                    className="flex min-h-[60px] items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas"
                  >
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={profile?.name ?? profile?.username ?? ''}
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-sm font-semibold text-amber-800">
                        {initial}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {profile?.name ?? profile?.username ?? '（名前なし）'}
                        {isSelf && (
                          <span className="ml-1.5 text-xs font-normal text-ink-sub">（あなた）</span>
                        )}
                      </p>
                      {profile?.username && (
                        <p className="truncate text-xs text-ink-sub">@{profile.username}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm text-ink-sub" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
