import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { parseGroupSearchParams } from '@/lib/restaurants/groupSearch'
import GroupConditionsForm from './GroupConditionsForm'

type GroupConditionsPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function memberCountToPartyLabel(count: number): string {
  if (count <= 1) return '1人'
  if (count === 2) return '2人'
  if (count <= 4) return '3〜4人'
  return '5人以上'
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

  const [groupResult, membersResult] = await Promise.all([
    supabase.from('groups').select('id, name').eq('id', groupId).maybeSingle(),
    supabase.from('group_members').select('user_id').eq('group_id', groupId),
  ])

  if (groupResult.error) throw new Error('グループ情報を読み込めませんでした。')
  if (!groupResult.data) notFound()

  const group = groupResult.data as { id: string; name: string }
  const memberCount = (membersResult.data ?? []).length
  const partyLabel = memberCountToPartyLabel(memberCount)
  const initial = parseGroupSearchParams(raw)

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 pb-20">
      <div className="mx-auto max-w-md space-y-4">
        <Suspense>
          <BackButton fallbackHref={`/groups/${groupId}/recommendations`} label="← おすすめに戻る" />
        </Suspense>

        <div>
          <p className="text-xs text-ink-sub">{group.name}</p>
          <h1 className="text-xl font-bold text-ink">条件を指定</h1>
        </div>

        <GroupConditionsForm
          groupId={groupId}
          memberCount={memberCount}
          partyLabel={partyLabel}
          initial={initial}
        />
      </div>

      <BottomNav />
    </main>
  )
}
