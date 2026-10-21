'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Excludes visually ambiguous characters: 0/O, 1/I/L
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateInviteCode(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  // 256 % 32 === 0, so modulo is perfectly uniform over the 32-character set
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join('')
}

function toJapaneseError(err: unknown): string {
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
  | { kind: 'created'; groupId: string; inviteCode: string }

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
        if (error?.code === '23505') continue
        if (error) throw error
      }

      if (!groupId || !inviteCode) throw new Error('INVITE_CODE_RETRY_FAILED')

      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ group_id: groupId, user_id: user.id, role: 'member' })

      if (memberError) {
        setStep({ kind: 'member_failed', groupId, inviteCode })
        setCreateError('グループは作成されましたが、メンバー登録に失敗しました。もう一度お試しください')
        return
      }

      setStep({ kind: 'created', groupId, inviteCode })
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
        .insert({ group_id: groupId, user_id: user.id, role: 'member' })

      if (error) throw error

      setStep({ kind: 'created', groupId, inviteCode })
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

      router.push('/groups')
    } catch (err) {
      setJoinError(toJapaneseError(err))
    } finally {
      setJoining(false)
    }
  }

  if (step.kind === 'created') {
    return (
      <div className="mx-auto max-w-md px-4 pt-4">
        <div className="rounded-2xl border border-edge bg-surface p-8 text-center">
          <p className="mb-3 text-4xl" aria-hidden="true">🎉</p>
          <h2 className="mb-2 text-xl font-bold text-ink">グループを作成しました</h2>
          <p className="mb-6 text-sm text-ink-sub">
            以下の招待コードを友人に共有してください。
          </p>
          <div className="mb-6 rounded-2xl bg-[#F3E5D8] px-4 py-5">
            <p className="mb-1 text-xs font-medium text-ink-sub">招待コード</p>
            <span className="font-mono text-2xl font-bold tracking-widest text-ink">
              {step.inviteCode}
            </span>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/groups/${step.kind === 'created' ? step.groupId : ''}`)}
            className="w-full rounded-xl bg-terra py-3 text-sm font-bold text-white"
          >
            グループを見る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 pt-2">
      {/* Section 1: Create group */}
      <div className="rounded-2xl border border-edge bg-surface p-5">
        <div className="mb-4 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terra/10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="16" y1="11" x2="22" y2="11" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-ink">新しいグループを作る</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-sub">
              一緒にお店を探すメンバーのグループを<br />作成します
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label htmlFor="groupName" className="block text-sm font-bold text-ink mb-1.5">
              グループ名
            </label>
            <input
              id="groupName"
              type="text"
              required
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="例：情報工3年ごはん"
              className="w-full rounded-xl border border-edge bg-canvas px-4 py-3 text-sm text-ink placeholder:text-ink-sub/60 focus:border-terra focus:outline-none focus:ring-2 focus:ring-terra/20"
            />
          </div>

          {createError && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-xs text-red-600">{createError}</p>
          )}

          {step.kind === 'member_failed' ? (
            <button
              type="button"
              onClick={handleRetryMember}
              disabled={creating}
              className="w-full rounded-xl bg-terra py-3.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {creating ? '再試行中...' : 'メンバー登録を再試行'}
            </button>
          ) : (
            <button
              type="submit"
              disabled={creating || !createName.trim()}
              className="w-full rounded-xl bg-terra py-3.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {creating ? '作成中...' : 'グループを作成する'}
            </button>
          )}
        </form>
      </div>

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-edge" />
        <span className="text-xs text-ink-sub">または</span>
        <div className="flex-1 border-t border-edge" />
      </div>

      {/* Section 2: Join by invite code */}
      <div className="rounded-2xl border border-edge bg-surface p-5">
        <div className="mb-4 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-ink">招待コードで参加する</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-sub">
              友達から共有された招待コードを<br />入力してください
            </p>
          </div>
        </div>

        <form onSubmit={handleJoin} className="space-y-3">
          <div>
            <label htmlFor="inviteCode" className="block text-sm font-bold text-ink mb-1.5">
              招待コード
            </label>
            <input
              id="inviteCode"
              type="text"
              required
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="例：ABCD1234"
              className="w-full rounded-xl border border-edge bg-canvas px-4 py-3 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-sub/60 focus:border-terra focus:outline-none focus:ring-2 focus:ring-terra/20"
            />
          </div>

          {joinError && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-xs text-red-600">{joinError}</p>
          )}

          <button
            type="submit"
            disabled={joining || !joinCode.trim()}
            className={`w-full rounded-xl py-3.5 text-sm font-bold transition-colors ${
              joinCode.trim()
                ? 'bg-terra text-white'
                : 'bg-[#F3E5D8] text-terra/60'
            }`}
          >
            {joining ? '参加中...' : 'グループに参加する'}
          </button>
        </form>
      </div>
    </div>
  )
}
