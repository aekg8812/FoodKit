import Link from 'next/link'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import AvatarUploadForm from '@/app/settings/AvatarUploadForm'
import ProfileNameForm from './ProfileNameForm'

export default async function ProfileEditPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data: profile, error } = await supabase
    .from('users')
    .select('name, username, avatar_path, updated_at')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('ProfileEditPage: failed to load profile', {
      message: error.message,
      code: error.code,
    })
    throw new Error('プロフィール情報を読み込めませんでした。')
  }

  const publicAvatarUrl = profile.avatar_path
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null
  const avatarUrl =
    publicAvatarUrl && profile.updated_at
      ? `${publicAvatarUrl}?v=${encodeURIComponent(profile.updated_at)}`
      : publicAvatarUrl

  return (
    <main className="min-h-screen bg-canvas pb-24">
      <div className="mx-auto w-full max-w-md px-4 pt-6 space-y-6">
        <Link
          href="/mypage"
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-ink-sub transition-colors hover:text-ink"
        >
          ← マイページに戻る
        </Link>

        <h1 className="text-2xl font-bold text-ink">プロフィールを編集</h1>

        {/* Avatar */}
        <section className="rounded-2xl border border-edge bg-surface overflow-hidden">
          <AvatarUploadForm userId={user.id} currentAvatarUrl={avatarUrl} />
        </section>

        {/* Name */}
        <section className="rounded-2xl border border-edge bg-surface p-5">
          <h2 className="mb-4 font-semibold text-ink">名前</h2>
          <ProfileNameForm userId={user.id} currentName={profile.name} />
        </section>

        {/* Username — display only, link to settings */}
        <section className="rounded-2xl border border-edge bg-surface p-5">
          <h2 className="mb-1 font-semibold text-ink">ユーザーID</h2>
          <p className="mb-3 text-sm text-ink-sub">@{profile.username}</p>
          <Link
            href="/settings/username"
            className="inline-flex min-h-[40px] items-center rounded-full border border-edge bg-canvas px-5 text-sm font-medium text-ink transition-colors hover:bg-surface"
          >
            設定から変更
          </Link>
        </section>
      </div>

      <BottomNav />
    </main>
  )
}
