import { redirect } from 'next/navigation'
import Link from 'next/link'
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
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Link
          href="/mypage"
          className="flex h-10 w-10 items-center justify-center text-ink"
          aria-label="マイページに戻る"
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
            <path d="M9 1L1 9l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-ink">プロフィールを編集</h1>
        <div className="w-10" />
      </div>

      <div className="mx-auto w-full max-w-md px-4 pt-4 space-y-4">
        {/* Avatar — centered with "写真を変更" */}
        <div className="rounded-2xl border border-edge bg-surface">
          <AvatarUploadForm userId={user.id} currentAvatarUrl={avatarUrl} />
        </div>

        {/* Name + ユーザーID + save */}
        <div className="rounded-2xl border border-edge bg-surface divide-y divide-edge overflow-hidden">
          {/* Name form */}
          <div className="p-4">
            <ProfileNameForm userId={user.id} currentName={profile.name} />
          </div>

          {/* ユーザーID row */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-xs text-ink-sub">ユーザーID</p>
              <p className="mt-0.5 text-sm font-medium text-ink">@{profile.username}</p>
            </div>
            <Link
              href="/settings/username"
              className="text-sm font-bold text-terra"
            >
              設定から変更 ›
            </Link>
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
