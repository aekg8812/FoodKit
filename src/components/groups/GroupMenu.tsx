'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomSheet from '@/components/ui/BottomSheet'
import ValueTypeBadge from '@/components/ValueTypeBadge'
import { createClient } from '@/lib/supabase/client'

export type GroupMenuMember = {
  id: string
  name: string
  valueType: string | null
}

type GroupMenuProps = {
  groupId: string
  groupName: string
  inviteCode: string
  currentUserId: string
  members: GroupMenuMember[]
  isCurrentMember: boolean
}

type MenuMode = 'menu' | 'leave-confirm' | 'delete-confirm'

export default function GroupMenu({
  groupId,
  groupName,
  inviteCode,
  currentUserId,
  members,
  isCurrentMember,
}: GroupMenuProps) {
  const router = useRouter()
  const inFlightRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<MenuMode>('menu')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('GroupMenu: failed to copy invite code', error)
      setErrorMessage('招待コードをコピーできませんでした。コードを直接選択してください。')
    }
  }

  async function handleLeave() {
    if (inFlightRef.current) return

    inFlightRef.current = true
    setLoading(true)
    setErrorMessage(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUserId)
        .select('group_id')

      if (error) {
        console.error('GroupMenu: failed to leave group', error)
        setErrorMessage('グループから退会できませんでした。もう一度お試しください。')
        return
      }
      if (!data || data.length === 0) {
        console.error('GroupMenu: membership was not deleted', { groupId, currentUserId })
        setErrorMessage('参加情報を確認できませんでした。画面を更新してお試しください。')
        return
      }

      router.push('/friends?tab=groups')
    } catch (error) {
      console.error('GroupMenu: unexpected leave error', error)
      setErrorMessage('グループから退会できませんでした。もう一度お試しください。')
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (inFlightRef.current || deleteConfirmation !== groupName) return

    inFlightRef.current = true
    setLoading(true)
    setErrorMessage(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.rpc('delete_group', {
        p_group_id: groupId,
      })

      if (error) {
        console.error('GroupMenu: failed to delete group', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        })
        setErrorMessage('グループを削除できませんでした。もう一度お試しください。')
        return
      }

      router.push('/friends?tab=groups')
    } catch (error) {
      console.error('GroupMenu: unexpected delete error', error)
      setErrorMessage('グループを削除できませんでした。もう一度お試しください。')
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setMode('menu')
    setErrorMessage(null)
    setDeleteConfirmation('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMode('menu')
          setErrorMessage(null)
          setDeleteConfirmation('')
          setOpen(true)
        }}
        aria-label="グループメニューを開く"
        aria-expanded={open}
        aria-controls="group-menu"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-surface text-xl font-bold text-ink transition-colors hover:bg-canvas"
      >
        <span aria-hidden="true">≡</span>
      </button>

      <BottomSheet
        id="group-menu"
        open={open}
        title={
          mode === 'menu'
            ? 'グループメニュー'
            : mode === 'leave-confirm'
              ? 'グループから退会'
              : 'グループを削除'
        }
        onClose={handleClose}
      >
        {mode === 'menu' ? (
          <div className="space-y-6">
            <section aria-labelledby="group-menu-members-heading">
              <h3 id="group-menu-members-heading" className="mb-3 text-sm font-bold text-ink">
                メンバー
              </h3>
              {members.length === 0 ? (
                <p className="text-sm text-ink-sub">メンバー情報を表示できません</p>
              ) : (
                <ul className="divide-y divide-edge rounded-xl border border-edge px-4">
                  {members.map((member) => (
                    <li key={member.id} className="py-3">
                      <p className="text-sm font-medium text-ink">
                        {member.name}
                        {member.id === currentUserId ? (
                          <span className="ml-1.5 text-xs font-normal text-ink-sub">(あなた)</span>
                        ) : null}
                      </p>
                      <div className="mt-1.5">
                        <ValueTypeBadge type={member.valueType} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="group-menu-invite-heading">
              <h3 id="group-menu-invite-heading" className="mb-3 text-sm font-bold text-ink">
                招待コード
              </h3>
              <div className="flex items-center gap-3">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-canvas px-3 py-3 font-mono text-sm text-ink">
                  {inviteCode}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="min-h-11 shrink-0 rounded-full border border-edge px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas"
                >
                  {copied ? 'コピー済み ✓' : 'コピー'}
                </button>
              </div>
            </section>

            {errorMessage ? (
              <p role="alert" className="text-sm text-red-600">
                {errorMessage}
              </p>
            ) : null}

            {isCurrentMember ? (
              <div className="space-y-6">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null)
                    setMode('leave-confirm')
                  }}
                  className="min-h-11 w-full rounded-xl border border-red-200 px-4 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
                >
                  グループから退会する
                </button>

                <section className="border-t border-edge pt-6" aria-labelledby="danger-zone-heading">
                  <h3 id="danger-zone-heading" className="mb-2 text-sm font-bold text-red-600">
                    危険な操作
                  </h3>
                  <p className="mb-3 text-xs leading-5 text-ink-sub">
                    グループを削除すると、すべてのメンバーがアクセスできなくなります。
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null)
                      setDeleteConfirmation('')
                      setMode('delete-confirm')
                    }}
                    className="min-h-11 w-full rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  >
                    グループを削除する
                  </button>
                </section>
              </div>
            ) : (
              <p className="rounded-xl bg-canvas p-4 text-sm text-ink-sub">
                このグループには参加していません
              </p>
            )}
          </div>
        ) : mode === 'leave-confirm' ? (
          <div>
            <p className="text-sm leading-6 text-ink-sub">
              「{groupName}」から退会しますか？退会すると、このグループで共有されている店舗が見られなくなります。
            </p>
            {errorMessage ? (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {errorMessage}
              </p>
            ) : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setErrorMessage(null)
                  setMode('menu')
                }}
                className="min-h-11 rounded-xl border border-edge px-4 text-sm font-bold text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleLeave()}
                className="min-h-11 rounded-xl bg-terra px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? '退会中…' : '退会する'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-600">この操作は元に戻せません</p>
              <p className="mt-2 text-sm leading-6 text-ink-sub">
                グループ「{groupName}」を削除すると、メンバー全員がアクセスできなくなり、メンバー情報・共有設定・グループに紐づくデータが削除されます。
              </p>
            </div>

            <div className="mt-5">
              <label htmlFor="delete-group-confirmation" className="mb-2 block text-sm font-bold text-ink">
                確認のため「{groupName}」と入力してください
              </label>
              <input
                id="delete-group-confirmation"
                type="text"
                value={deleteConfirmation}
                disabled={loading}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                autoComplete="off"
                className="min-h-11 w-full rounded-xl border border-edge bg-surface px-4 text-sm text-ink outline-none transition-colors focus:border-terra disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {errorMessage ? (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setErrorMessage(null)
                  setDeleteConfirmation('')
                  setMode('menu')
                }}
                className="min-h-11 rounded-xl border border-edge px-4 text-sm font-bold text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={loading || deleteConfirmation !== groupName}
                onClick={() => void handleDelete()}
                className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? '削除中…' : '完全に削除する'}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  )
}
