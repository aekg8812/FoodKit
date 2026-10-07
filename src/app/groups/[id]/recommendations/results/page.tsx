import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { parseGroupSearchParams, serializeGroupSearchParams } from '@/lib/restaurants/groupSearch'
import GroupResultsClient from './GroupResultsClient'

type GroupResultsPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function memberCountToPartyTag(count: number): string {
  if (count <= 1) return 'solo'
  if (count === 2) return 'pair'
  if (count <= 4) return 'small_group'
  return 'large_group'
}

type PrefSummaryRow = {
  valid_member_count: number
}

export default async function GroupResultsPage({ params, searchParams }: GroupResultsPageProps) {
  const { id: groupId } = await params
  const raw = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [groupResult, membersResult, prefSummaryResult] = await Promise.all([
    supabase.from('groups').select('id, name').eq('id', groupId).maybeSingle(),
    supabase.from('group_members').select('user_id').eq('group_id', groupId),
    supabase.rpc('get_group_preference_summary', { p_group_id: groupId }),
  ])

  if (groupResult.error) throw new Error('グループ情報を読み込めませんでした。')
  if (!groupResult.data) notFound()

  const group = groupResult.data as { id: string; name: string }
  const memberCount = (membersResult.data ?? []).length
  const partyTag = memberCountToPartyTag(memberCount)

  const prefRows = (prefSummaryResult.data ?? []) as PrefSummaryRow[]
  const validMemberCount = prefRows.length > 0 ? Number(prefRows[0].valid_member_count) : 0

  const parsed = parseGroupSearchParams(raw)
  const conditionQs = serializeGroupSearchParams(parsed).toString()
  const changeHref = `/groups/${groupId}/recommendations/conditions${conditionQs ? `?${conditionQs}` : ''}`

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 pb-20">
      <div className="mx-auto max-w-md space-y-4">
        <Suspense>
          <BackButton fallbackHref={changeHref} label="← 条件を変更" />
        </Suspense>

        <div>
          <p className="text-xs text-ink-sub">{group.name}</p>
          <h1 className="text-xl font-bold text-ink">条件付きおすすめ</h1>
        </div>

        <GroupResultsClient
          groupId={groupId}
          partyTag={partyTag}
          params={parsed}
          validMemberCount={validMemberCount}
          changeHref={changeHref}
        />
      </div>

      <BottomNav />
    </main>
  )
}
