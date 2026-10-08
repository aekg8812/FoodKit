import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import InviteActions from './InviteActions'

type GroupInvitePageProps = {
  params: Promise<{ id: string }>
}

export default async function GroupInvitePage({ params }: GroupInvitePageProps) {
  const { id: groupId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data, error } = await supabase
    .from('groups')
    .select('id, name, invite_code')
    .eq('id', groupId)
    .maybeSingle()

  if (error) throw new Error('グループ情報を読み込めませんでした。')
  if (!data) notFound()

  const group = data as { id: string; name: string; invite_code: string }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <Suspense>
          <BackButton fallbackHref={`/groups/${groupId}`} label="" />
        </Suspense>
        <h1 className="text-base font-bold text-ink">グループに招待</h1>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-md px-4 space-y-4">

        <div className="rounded-2xl border border-edge bg-surface p-5 shadow-sm space-y-4">
          <div>
            <p className="text-sm font-semibold text-ink">招待コード</p>
            <p className="mt-1 text-xs text-ink-sub">
              このコードをシェアして、グループに招待しましょう
            </p>
          </div>
          <code className="block w-full rounded-xl bg-canvas px-4 py-3 font-mono text-lg font-bold text-ink text-center tracking-widest">
            {group.invite_code}
          </code>
          <InviteActions groupName={group.name} inviteCode={group.invite_code} />
        </div>

        <div className="rounded-2xl border border-edge bg-surface px-5 py-4">
          <p className="text-xs text-ink-sub">
            招待を受けた人は「グループに参加」から上記コードを入力して参加できます。
          </p>
        </div>
      </div>

      <BottomNav />
    </main>
  )
}

