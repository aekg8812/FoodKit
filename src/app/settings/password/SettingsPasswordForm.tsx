'use client'

import Link from 'next/link'
import { useState } from 'react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/client'

const PASSWORD_MIN = 6

export default function SettingsPasswordForm() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const tooShort = newPassword !== '' && newPassword.length < PASSWORD_MIN
  const mismatch = confirmPassword !== '' && newPassword !== confirmPassword
  const canSubmit =
    newPassword.length >= PASSWORD_MIN && confirmPassword !== '' && newPassword === confirmPassword

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      console.error('SettingsPasswordForm: failed to update password', error)
      setError('パスワードを変更できませんでした。もう一度お試しください。')
      setLoading(false)
      return
    }

    setLoading(false)
    setSuccess(true)
    setNewPassword('')
    setConfirmPassword('')
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
              error={tooShort ? `${PASSWORD_MIN}文字以上で入力してください` : undefined}
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
              <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">
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
