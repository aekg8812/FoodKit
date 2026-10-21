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
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Link href="/mypage" className="flex h-10 w-10 items-center justify-center text-ink" aria-label="戻る">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
            <path d="M9 1 L1 9 L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-ink">設定</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 pt-5 space-y-6">
        {/* アカウント */}
        <section>
          <p className="mb-2 text-sm font-bold text-ink">アカウント</p>
          <div className="divide-y divide-edge overflow-hidden rounded-2xl bg-surface">
            <Link
              href="/settings/username"
              className="flex min-h-[56px] items-center gap-3 px-4 py-3 hover:bg-canvas"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <div className="flex-1">
                <p className="font-medium text-ink">ユーザーID</p>
                <p className="text-xs text-ink-sub">@{profile.username}</p>
              </div>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </section>

        {/* セキュリティ */}
        <section>
          <p className="mb-2 text-sm font-bold text-ink">セキュリティ</p>
          <div className="divide-y divide-edge overflow-hidden rounded-2xl bg-surface">
            <Link
              href="/settings/password"
              className="flex min-h-[56px] items-center gap-3 px-4 py-3 hover:bg-canvas"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <span className="flex-1 font-medium text-ink">パスワードを変更</span>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </section>

        {/* その他 */}
        <section>
          <p className="mb-2 text-sm font-bold text-ink">その他</p>
          <div className="divide-y divide-edge overflow-hidden rounded-2xl bg-surface">
            <button
              type="button"
              disabled
              className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span className="flex-1 text-left font-medium text-ink">利用規約</span>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              disabled
              className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span className="flex-1 text-left font-medium text-ink">プライバシーポリシー</span>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
                <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </section>

        {/* Logout */}
        <section>
          <div className="overflow-hidden rounded-2xl bg-[#FFF3EC]">
            <SettingsLogoutSection />
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  )
}
