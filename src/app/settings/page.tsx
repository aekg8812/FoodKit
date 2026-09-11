import Link from 'next/link'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'
import { createClient } from '@/lib/supabase/server'
import AvatarUploadForm from './AvatarUploadForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // users は self-only の RLS のため、id = auth.uid() の自分の行だけを明示指定で取得する
  const { data: profile, error } = await supabase
    .from('users')
    .select('username, avatar_path, updated_at')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('SettingsPage: failed to load username', error)
    throw new Error('設定情報を読み込めませんでした。')
  }

  const publicAvatarUrl = profile.avatar_path
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null
  const avatarUrl =
    publicAvatarUrl && profile.updated_at
      ? `${publicAvatarUrl}?v=${encodeURIComponent(profile.updated_at)}`
      : publicAvatarUrl

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

          <div className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge">
            <AvatarUploadForm userId={user.id} currentAvatarUrl={avatarUrl} />
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
              <span className="font-medium text-ink">パスワード変更</span>
              <span className="text-ink-sub">›</span>
            </Link>
          </div>

          <LogoutButton />
        </section>
      </div>
    </main>
  )
}
