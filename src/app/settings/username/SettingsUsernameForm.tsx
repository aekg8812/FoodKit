'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/client'
import {
  USERNAME_MAX,
  checkUsernameAvailable,
  usernameErrorMessage,
  validateUsernameFormat,
} from '@/lib/users/username'

// 入力が止まってから空き確認を投げるまでの待ち時間（設計書 E1 §5 と同じ値）
const USERNAME_CHECK_DELAY_MS = 400

type UsernameCheck = {
  value: string
  available: boolean
  error: string | null
}

type Props = {
  userId: string
  currentUsername: string
}

export default function SettingsUsernameForm({ userId, currentUsername }: Props) {
  const [username, setUsername] = useState(currentUsername)
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheck | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // 空き確認の結果が古い入力を上書きしないようにする世代カウンタ
  const checkSeq = useRef(0)

  const formatError = username === '' ? null : validateUsernameFormat(username)
  const isUnchanged = username === currentUsername
  const currentCheck = usernameCheck?.value === username ? usernameCheck : null
  const usernameAvailable = currentCheck?.available ?? false
  const usernameError = formatError ?? currentCheck?.error ?? null
  const usernameChecking =
    username !== '' && !isUnchanged && formatError === null && currentCheck === null

  useEffect(() => {
    if (username === '') return
    if (isUnchanged) return // 自分の現在のIDはDBに問い合わせるまでもない
    if (validateUsernameFormat(username) !== null) return

    const seq = ++checkSeq.current
    const timer = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(username)
        if (seq !== checkSeq.current) return
        setUsernameCheck({
          value: username,
          available,
          error: available
            ? null
            : 'このユーザーIDは使用できません。すでに使われているか、予約語です',
        })
      } catch {
        if (seq !== checkSeq.current) return
        // 生エラーは checkUsernameAvailable 内で console.error 済み
        setUsernameCheck({
          value: username,
          available: false,
          error: 'ユーザーIDを確認できませんでした。通信環境を確認してください',
        })
      }
    }, USERNAME_CHECK_DELAY_MS)

    return () => clearTimeout(timer)
  }, [username, isUnchanged])

  const canSubmit = !isUnchanged && !usernameChecking && !usernameError && usernameAvailable

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setSubmitError(null)
    setSuccess(false)

    const { error } = await supabase.from('users').update({ username }).eq('id', userId)

    if (error) {
      console.error('SettingsUsernameForm: failed to update username', error)
      setSubmitError(usernameErrorMessage(error.code))
      setLoading(false)
      return
    }

    setLoading(false)
    setSuccess(true)
    router.refresh()
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
          <h1 className="text-2xl font-bold text-ink">ユーザーID変更</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <InputField
                id="username"
                label="ユーザーID"
                type="text"
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.trim())
                  setSuccess(false)
                }}
                error={usernameError ?? undefined}
                maxLength={USERNAME_MAX}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
              {!usernameError && (
                <p
                  className={`mt-1 text-xs ${usernameAvailable && !isUnchanged ? 'text-green-700' : 'text-ink-sub'}`}
                  aria-live="polite"
                >
                  {isUnchanged
                    ? '現在のユーザーIDです'
                    : usernameChecking
                      ? '確認中...'
                      : usernameAvailable
                        ? 'このユーザーIDは使えます'
                        : '半角英数字と _ . - が使えます'}
                </p>
              )}
            </div>

            {submitError && <ErrorMessage message={submitError} />}
            {success && (
              <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                ユーザーIDを変更しました
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
