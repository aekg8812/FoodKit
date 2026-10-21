import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import InviteActions from './InviteActions'

type GroupInvitePageProps = {
  params: Promise<{ id: string }>
}

type PrefCardRow = {
  label: string
  sort_order: number
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

  const [groupResult, membersResult, prefResult] = await Promise.all([
    supabase.from('groups').select('id, name, invite_code').eq('id', groupId).maybeSingle(),
    supabase.from('group_members').select('user_id').eq('group_id', groupId),
    supabase.rpc('get_group_preference_summary', { p_group_id: groupId }),
  ])

  if (groupResult.error) throw new Error('グループ情報を読み込めませんでした。')
  if (!groupResult.data) notFound()

  const group = groupResult.data as { id: string; name: string; invite_code: string }
  const memberCount = (membersResult.data ?? []).length
  const prefChips = ((prefResult.data ?? []) as PrefCardRow[]).slice(0, 3)

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <div className="flex items-center">
          <Link
            href={`/groups/${groupId}`}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-sub hover:bg-edge"
            aria-label="戻る"
          >
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
              <path d="M9 1L1 9l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="flex-1 text-center text-base font-bold text-ink">招待コードを共有</h1>
          <div className="w-10" />
        </div>
        <p className="mt-1 text-center text-xs leading-relaxed text-ink-sub">
          友達に招待コードを送って、<br />グループに参加してもらいましょう
        </p>
      </div>

      <div className="mx-auto max-w-md px-4 pt-4 space-y-5">

        {/* Group summary card */}
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
            {prefChips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {prefChips.map(c => (
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

        {/* Invite code section */}
        <div>
          <p className="mb-3 font-bold text-ink">招待コード</p>
          <div className="rounded-2xl border border-edge bg-surface p-5">
            <div className="rounded-xl bg-[#F3E5D8] px-4 py-5 text-center">
              <span className="font-mono text-3xl font-black tracking-widest text-ink">
                {group.invite_code}
              </span>
            </div>
            <div className="mt-3 flex justify-center">
              <InviteActions groupName={group.name} inviteCode={group.invite_code} variant="copy-only" />
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl bg-terra/10 px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs leading-relaxed text-terra">
            このコードを入力すると、<br />このグループに参加できます
          </p>
        </div>

        {/* Share rows */}
        <div>
          <p className="mb-3 font-bold text-ink">共有する</p>
          <InviteActions groupName={group.name} inviteCode={group.invite_code} variant="share-rows" />
        </div>

        {/* CTA button */}
        <InviteActions groupName={group.name} inviteCode={group.invite_code} variant="cta" />

      </div>

      <BottomNav />
    </main>
  )
}
