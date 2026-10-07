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
    <main className="min-h-screen bg-canvas px-6 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <Link
          href="/settings"
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-ink-sub transition-colors hover:text-ink"
        >
          ← 設定に戻る
        </Link>

        <section className="space-y-6 rounded-3xl border border-edge bg-surface p-6">
          <h1 className="text-2xl font-bold text-ink">パスワード変更</h1>

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

            {error && <ErrorMessage message={error} />}
            {success && (
              <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                パスワードを変更しました
              </p>
            )}

            <Button type="submit" loading={loading} disabled={!canSubmit}>
              {loading ? '変更中...' : '変更する'}
            </Button>
          </form>
        </section>
      </div>
    </main>
  )
}
