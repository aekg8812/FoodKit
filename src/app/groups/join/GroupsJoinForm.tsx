'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import LogoutButton from '@/components/LogoutButton'
import Button from '@/components/ui/Button'
import InputField from '@/components/ui/InputField'
import ErrorMessage from '@/components/ui/ErrorMessage'

// Excludes visually ambiguous characters: 0/O, 1/I/L
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateInviteCode(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  // 256 % 32 === 0, so modulo is perfectly uniform over the 32-character set
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join('')
}

function toJapaneseError(err: unknown): string {
  // Log raw error details for debugging before translating to user-facing message.
  if (err !== null && typeof err === 'object') {
    const { message, code, details, hint } = err as Record<string, unknown>
    console.error('[GroupsJoinForm] error:', { message, code, details, hint })
  } else {
    console.error('[GroupsJoinForm] error:', err)
  }

  const msg =
    err instanceof Error
      ? err.message
      : err !== null && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : ''
  if (msg === 'INVITE_CODE_RETRY_FAILED')
    return '招待コードの生成に失敗しました。もう一度お試しください'
  if (msg.includes('Invalid invite code')) return '招待コードが正しくありません'
  if (msg.includes('Authentication is required'))
    return 'ログインが必要です。再度ログインしてください'
  return 'エラーが発生しました。時間をおいて再度お試しください'
}

type FormStep =
  | { kind: 'form' }
  | { kind: 'member_failed'; groupId: string; inviteCode: string }
  | { kind: 'created'; inviteCode: string }

export default function GroupsJoinForm() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<FormStep>({ kind: 'form' })
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Authentication is required')

      let groupId: string | null = null
      let inviteCode: string | null = null

      for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateInviteCode()
        const { data, error } = await supabase
          .from('groups')
          .insert({ name: createName, invite_code: code, created_by: user.id })
          .select('id')
          .single()

        if (!error && data) {
          groupId = data.id as string
          inviteCode = code
          break
        }
        if (error?.code === '23505') continue // UNIQUE violation on invite_code → regenerate
        if (error) throw error
      }

      if (!groupId || !inviteCode) throw new Error('INVITE_CODE_RETRY_FAILED')

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: groupId, user_id: user.id, role: 'owner' })

      if (memberError) {
        // Step 1 succeeded but step 2 failed. Preserve groupId so the user can retry step 2 only.
        setStep({ kind: 'member_failed', groupId, inviteCode })
        setCreateError('グループは作成されましたが、メンバー登録に失敗しました。もう一度お試しください')
        return
      }

      setStep({ kind: 'created', inviteCode })
    } catch (err) {
      setCreateError(toJapaneseError(err))
    } finally {
      setCreating(false)
    }
  }

  async function handleRetryMember() {
    if (step.kind !== 'member_failed') return
    const { groupId, inviteCode } = step
    setCreating(true)
    setCreateError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Authentication is required')

      const { error } = await supabase
        .from('group_members')
        .insert({ group_id: groupId, user_id: user.id, role: 'owner' })

      if (error) throw error

      setStep({ kind: 'created', inviteCode })
    } catch (err) {
      setCreateError(toJapaneseError(err))
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setJoining(true)
    setJoinError(null)

    try {
      const { error } = await supabase.rpc('join_group_by_invite_code', {
        input_invite_code: joinCode,
      })
      if (error) throw error

      router.refresh()
      router.push('/onboarding')
    } catch (err) {
      setJoinError(toJapaneseError(err))
    } finally {
      setJoining(false)
    }
  }

  if (step.kind === 'created') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16">
        <section className="w-full max-w-md rounded-2xl border border-edge bg-surface p-8 shadow-sm">
          <p className="mb-3 text-center text-3xl" aria-hidden="true">🎉</p>
          <h1 className="mb-2 text-center text-2xl font-bold text-ink">グループを作成しました</h1>
          <p className="mb-6 text-center text-sm text-ink-sub">
            以下の招待コードを友人に共有してください。
          </p>
          <div className="mb-6 rounded-2xl bg-cream px-4 py-5 text-center">
            <p className="mb-1 text-xs font-medium text-ink-sub">招待コード</p>
            <span className="font-mono text-2xl font-bold tracking-widest text-ink">
              {step.inviteCode}
            </span>
          </div>
          <Button
            type="button"
            onClick={() => {
              router.refresh()
              router.push('/onboarding')
            }}
          >
            オンボーディングに進む
          </Button>
        </section>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16">
      <div className="mb-6 text-center">
        <span className="text-3xl" aria-hidden="true">🍽️</span>
        <p className="mt-1 text-sm font-medium text-ink-sub">FoodKit</p>
      </div>

      <section className="w-full max-w-md space-y-6">
        <div className="rounded-2xl border border-edge bg-surface p-8 shadow-sm">
          <h1 className="mb-1 text-2xl font-bold text-ink">グループに参加する</h1>
          <p className="mb-7 text-sm leading-relaxed text-ink-sub">
            グループを新しく作るか、招待コードで既存のグループに参加してください。
          </p>

          {/* グループ作成 */}
          <div className="mb-7">
            <h2 className="mb-3 text-base font-semibold text-ink">グループを作成</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <InputField
                id="groupName"
                label="グループ名"
                type="text"
                required
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="例：大学の友人グループ"
              />

              {createError && <ErrorMessage message={createError} />}

              {step.kind === 'member_failed' ? (
                <Button type="button" variant="secondary" onClick={handleRetryMember} disabled={creating}>
                  {creating ? '再試行中...' : 'メンバー登録を再試行'}
                </Button>
              ) : (
                <Button type="submit" disabled={creating}>
                  {creating ? '作成中...' : 'グループを作成'}
                </Button>
              )}
            </form>
          </div>

          {/* 区切り */}
          <div className="relative mb-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-edge" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface px-3 text-xs text-ink-sub">または</span>
            </div>
          </div>

          {/* グループ参加 */}
          <div>
            <h2 className="mb-3 text-base font-semibold text-ink">招待コードで参加</h2>
            <form onSubmit={handleJoin} className="space-y-3">
              <InputField
                id="inviteCode"
                label="招待コード"
                type="text"
                required
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="font-mono placeholder:font-sans"
                placeholder="ABCD1234"
              />

              {joinError && <ErrorMessage message={joinError} />}

              <Button type="submit" disabled={joining}>
                {joining ? '参加中...' : 'グループに参加'}
              </Button>
            </form>
          </div>
        </div>

        <div className="flex justify-center">
          <LogoutButton />
        </div>
      </section>
    </main>
  )
}
