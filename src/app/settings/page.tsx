import Link from 'next/link'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import SettingsLogoutSection from './SettingsLogoutSection'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data: profile, error } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('SettingsPage: failed to load profile', {
      message: error.message,
      code: error.code,
    })
    throw new Error('設定情報を読み込めませんでした。')
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <Link
          href="/mypage"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-sub transition-colors hover:bg-surface"
          aria-label="マイページに戻る"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-base font-bold text-ink">設定</h1>
        <div className="w-10" />
      </div>

      <div className="mx-auto w-full max-w-md px-4 space-y-5">

        {/* Account */}
        <section>
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-sub">アカウント</p>
          <div className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-surface">
            <Link
              href="/settings/username"
              className="flex min-h-[44px] items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-canvas"
            >
              <span className="font-medium text-ink">ユーザーID</span>
              <span className="text-ink-sub">@{profile.username} ›</span>
            </Link>
            <Link
              href="/settings/password"
              className="flex min-h-[44px] items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-canvas"
            >
              <span className="font-medium text-ink">パスワードを変更</span>
              <span className="text-ink-sub">›</span>
            </Link>
          </div>
        </section>

        {/* Legal — V3 UI only */}
        <section>
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-sub">法的情報</p>
          <div className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-surface">
            <button
              type="button"
              disabled
              className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-sm opacity-50"
              title="V3以降で公開予定"
            >
              <span className="font-medium text-ink">利用規約</span>
              <span className="text-ink-sub">準備中 ›</span>
            </button>
            <button
              type="button"
              disabled
              className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-sm opacity-50"
              title="V3以降で公開予定"
            >
              <span className="font-medium text-ink">プライバシーポリシー</span>
              <span className="text-ink-sub">準備中 ›</span>
            </button>
          </div>
        </section>

        {/* Logout */}
        <section>
          <div className="overflow-hidden rounded-2xl border border-edge bg-surface">
            <SettingsLogoutSection />
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  )
}

