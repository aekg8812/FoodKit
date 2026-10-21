'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/client'

const PASSWORD_MIN = 6

type Props = {
  userEmail: string
}

export default function SettingsPasswordForm({ userEmail }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const newTooShort = newPassword !== '' && newPassword.length < PASSWORD_MIN
  const mismatch = confirmPassword !== '' && newPassword !== confirmPassword
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= PASSWORD_MIN &&
    confirmPassword !== '' &&
    newPassword === confirmPassword

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    // Verify current password via re-authentication
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: currentPassword,
    })

    if (signInError) {
      // Do not log password fields
      console.error('SettingsPasswordForm: re-authentication failed', {
        message: signInError.message,
        code: signInError.status,
      })
      setError('現在のパスワードが正しくありません。')
      setLoading(false)
      return
    }

    // Current password verified — update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      console.error('SettingsPasswordForm: failed to update password', {
        message: updateError.message,
        code: updateError.status,
      })
      setError('パスワードを変更できませんでした。もう一度お試しください。')
      setLoading(false)
      return
    }

    setLoading(false)
    setSuccess(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')

    // Navigate back to settings after short delay so success message is visible
    setTimeout(() => router.push('/settings'), 1500)
  }

  return (
    <main className="min-h-screen bg-canvas pb-10">
      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-6">
        <Link
          href="/settings"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-sub transition-colors hover:bg-surface"
          aria-label="設定に戻る"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-base font-bold text-ink">パスワードを変更</h1>
        <div className="w-10" />
      </div>

      <div className="px-5">
        <div className="mx-auto w-full max-w-sm space-y-5">
          <p className="text-sm text-ink-sub">現在のパスワードを入力して、新しいパスワードに変更します</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField
              id="current-password"
              label="現在のパスワード"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value)
                setSuccess(false)
              }}
              autoComplete="current-password"
            />

            <div>
              <InputField
                id="new-password"
                label="新しいパスワード"
                type="password"
                required
                minLength={PASSWORD_MIN}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setSuccess(false)
                }}
                error={newTooShort ? `${PASSWORD_MIN}文字以上で入力してください` : undefined}
                autoComplete="new-password"
              />
              {!newTooShort && (
                <p className="mt-1 text-xs text-ink-sub">8文字以上の半角英数字で設定してください</p>
              )}
            </div>

            <InputField
              id="confirm-password"
              label="新しいパスワード（確認）"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setSuccess(false)
              }}
              error={mismatch ? 'パスワードが一致しません' : undefined}
              autoComplete="new-password"
            />

            {/* Info note */}
            <div className="flex gap-2 rounded-xl border border-terra/20 bg-terra/5 px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs leading-relaxed text-terra">変更後は、新しいパスワードでログインしてください</p>
            </div>

            {error && <ErrorMessage message={error} />}
            {success && (
              <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                パスワードを変更しました
              </p>
            )}

            <Button type="submit" loading={loading} disabled={!canSubmit}>
              {loading ? '変更中...' : '変更を保存'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
