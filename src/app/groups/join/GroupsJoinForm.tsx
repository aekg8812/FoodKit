'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import LogoutButton from '@/components/LogoutButton'

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
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16">
        <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-2xl font-semibold text-zinc-950">グループを作成しました</h1>
          <p className="mb-6 text-sm text-zinc-600">以下の招待コードを友人に共有してください。</p>
          <div className="mb-6 rounded-md bg-zinc-100 px-4 py-4 text-center">
            <p className="mb-1 text-xs text-zinc-500">招待コード</p>
            <span className="font-mono text-2xl font-bold tracking-widest text-zinc-950">
              {step.inviteCode}
            </span>
          </div>
          <button
            onClick={() => {
              router.refresh()
              router.push('/onboarding')
            }}
            className="w-full rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            オンボーディングに進む
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16">
      <section className="w-full max-w-md space-y-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-2xl font-semibold text-zinc-950">グループに参加する</h1>
          <p className="mb-6 text-sm text-zinc-600">
            グループを新しく作るか、招待コードで既存のグループに参加してください。
          </p>

          {/* グループ作成 */}
          <div className="mb-6">
            <h2 className="mb-3 text-base font-medium text-zinc-950">グループを作成</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label htmlFor="groupName" className="block text-sm font-medium text-zinc-700">
                  グループ名
                </label>
                <input
                  id="groupName"
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
                  placeholder="例：大学の友人グループ"
                />
              </div>

              {createError && (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{createError}</p>
              )}

              {step.kind === 'member_failed' ? (
                <button
                  type="button"
                  onClick={handleRetryMember}
                  disabled={creating}
                  className="w-full rounded-full border border-zinc-950 px-5 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-50 disabled:opacity-50"
                >
                  {creating ? '再試行中...' : 'メンバー登録を再試行'}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
                >
                  {creating ? '作成中...' : 'グループを作成'}
                </button>
              )}
            </form>
          </div>

          {/* 区切り */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-zinc-400">または</span>
            </div>
          </div>

          {/* グループ参加 */}
          <div>
            <h2 className="mb-3 text-base font-medium text-zinc-950">招待コードで参加</h2>
            <form onSubmit={handleJoin} className="space-y-3">
              <div>
                <label htmlFor="inviteCode" className="block text-sm font-medium text-zinc-700">
                  招待コード
                </label>
                <input
                  id="inviteCode"
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-950 placeholder:font-sans placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
                  placeholder="ABCD1234"
                />
              </div>

              {joinError && (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{joinError}</p>
              )}

              <button
                type="submit"
                disabled={joining}
                className="w-full rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {joining ? '参加中...' : 'グループに参加'}
              </button>
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
