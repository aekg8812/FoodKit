import Link from 'next/link'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <main className="min-h-screen bg-canvas px-6 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <Link
          href="/mypage"
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-ink-sub transition-colors hover:text-ink"
        >
          ← マイページに戻る
        </Link>

        <section className="space-y-6 rounded-3xl border border-edge bg-surface p-6">
          <h1 className="text-2xl font-bold text-ink">設定</h1>

          {/* TODO(F2・すがけんさん): ユーザーID変更・パスワード変更をここに追加する */}
          <LogoutButton />
        </section>
      </div>
    </main>
  )
}
