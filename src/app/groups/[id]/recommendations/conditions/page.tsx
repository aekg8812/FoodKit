import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { parseGroupSearchParams } from '@/lib/restaurants/groupSearch'
import GroupConditionsForm from './GroupConditionsForm'

type GroupConditionsPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type PrefCardRow = {
  label: string
  sort_order: number
}

export default async function GroupConditionsPage({ params, searchParams }: GroupConditionsPageProps) {
  const { id: groupId } = await params
  const raw = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [groupResult, membersResult, prefResult] = await Promise.all([
    supabase.from('groups').select('id, name').eq('id', groupId).maybeSingle(),
    supabase.from('group_members').select('user_id').eq('group_id', groupId),
    supabase.rpc('get_group_preference_summary', { p_group_id: groupId }),
  ])

  if (groupResult.error) throw new Error('グループ情報を読み込めませんでした。')
  if (!groupResult.data) notFound()

  const memberCount = (membersResult.data ?? []).length
  const prefChips = ((prefResult.data ?? []) as PrefCardRow[]).slice(0, 5)
  const initial = parseGroupSearchParams(raw)

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Link
          href={`/groups/${groupId}/recommendations`}
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-sub hover:bg-edge"
          aria-label="戻る"
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
            <path d="M9 1L1 9l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-ink">みんなで店を探す</h1>
        <div className="w-10" />
      </div>

      {/* Group summary card */}
      <div className="mx-auto max-w-md px-4 pt-4">
        <Link
          href={`/groups/${groupId}`}
          className="flex items-center gap-4 rounded-2xl border border-edge bg-surface p-4"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F3E5D8]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{groupResult.data.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-sub">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {memberCount}人でお店を探します
            </p>
          </div>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
            <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <Suspense>
        <GroupConditionsForm
          groupId={groupId}
          memberCount={memberCount}
          prefChips={prefChips}
          initial={initial}
        />
      </Suspense>

      <BottomNav />
    </main>
  )
}
