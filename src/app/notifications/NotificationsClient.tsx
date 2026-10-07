'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

type NotificationRow = {
  id: string
  type: 'followed_user' | 'followed_by_user' | 'group_member_review'
  subject_user_id: string
  review_id: string | null
  read_at: string | null
  created_at: string
}

type ProfileRow = {
  id: string
  username: string | null
  name: string | null
  avatar_path: string | null
}

type ProcessedNotification = NotificationRow & {
  subject: ProfileRow | null
}

type TabValue = 'all' | 'unread'

function notificationMessage(n: ProcessedNotification): string {
  const name = n.subject?.name ?? n.subject?.username ?? 'ユーザー'
  if (n.type === 'followed_user')       return `${name}さんをフォローしました`
  if (n.type === 'followed_by_user')    return `${name}さんにフォローされました`
  if (n.type === 'group_member_review') return `${name}さんが新しい記録を追加しました`
  return ''
}

function notificationHref(n: ProcessedNotification): string {
  if (n.type === 'group_member_review' && n.review_id) return `/records/${n.review_id}`
  if (n.subject?.username) return `/users/${n.subject.username}`
  return '#'
}

type Props = {
  supabaseUrl: string
}

export default function NotificationsClient({ supabaseUrl }: Props) {
  const [notifications, setNotifications] = useState<ProcessedNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabValue>('all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()

      const { data: notifData, error } = await supabase
        .from('notifications')
        .select('id, type, subject_user_id, review_id, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(100)

      if (cancelled) return
      if (error || !notifData) { setLoading(false); return }

      const rows = notifData as NotificationRow[]
      const subjectIds = [...new Set(rows.map(n => n.subject_user_id))]

      const { data: profileData } = subjectIds.length > 0
        ? await supabase
            .from('user_public_profiles')
            .select('id, username, name, avatar_path')
            .in('id', subjectIds)
        : { data: [] }

      if (cancelled) return

      const profileMap = new Map(
        ((profileData ?? []) as ProfileRow[]).map(p => [p.id, p])
      )

      setNotifications(
        rows.map(n => ({ ...n, subject: profileMap.get(n.subject_user_id) ?? null }))
      )
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  async function handleClick(n: ProcessedNotification) {
    if (n.read_at) return
    const supabase = createClient()
    await supabase.rpc('mark_notification_read', { p_notification_id: n.id })
    setNotifications(prev =>
      prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)
    )
  }

  async function handleMarkAllRead() {
    const supabase = createClient()
    await supabase.rpc('mark_all_notifications_read')
    setNotifications(prev =>
      prev.map(x => ({ ...x, read_at: x.read_at ?? new Date().toISOString() }))
    )
  }

  const displayed = tab === 'unread'
    ? notifications.filter(n => !n.read_at)
    : notifications

  const unreadCount = notifications.filter(n => !n.read_at).length

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-full border border-edge bg-surface p-1">
          {(['all', 'unread'] as TabValue[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
                tab === t
                  ? 'bg-terra text-white'
                  : 'text-ink-sub hover:text-ink',
              ].join(' ')}
            >
              {t === 'all' ? 'すべて' : `未読${unreadCount > 0 ? `（${unreadCount}）` : ''}`}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs text-terra hover:underline"
          >
            すべて既読
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-10 text-center text-sm text-ink-sub">読み込み中…</div>
      ) : displayed.length === 0 ? (
        <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center">
          <p className="text-sm text-ink-sub">
            {tab === 'unread' ? '未読の通知はありません' : '通知はまだありません'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-surface">
          {displayed.map(n => {
            const href     = notificationHref(n)
            const message  = notificationMessage(n)
            const isUnread = !n.read_at
            const avatarPath = n.subject?.avatar_path
            const avatarUrl  = avatarPath
              ? `${supabaseUrl}/storage/v1/object/public/avatars/${avatarPath}`
              : null
            const initial  = Array.from(
              (n.subject?.name ?? n.subject?.username ?? '?').trim()
            )[0] ?? '?'

            return (
              <li key={n.id} className={isUnread ? 'bg-cream/30' : ''}>
                <Link
                  href={href}
                  onClick={() => handleClick(n)}
                  className="flex min-h-[64px] items-start gap-3 px-4 py-3 transition-colors hover:bg-canvas"
                >
                  {/* Subject avatar */}
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={n.subject?.name ?? ''}
                      width={36}
                      height={36}
                      className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-sm font-semibold text-amber-800">
                      {initial}
                    </span>
                  )}

                  {/* Message */}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-5 ${isUnread ? 'font-medium text-ink' : 'text-ink-sub'}`}>
                      {message}
                    </p>
                    <p className="mt-0.5 text-[10px] text-ink-sub">
                      {new Date(n.created_at).toLocaleDateString('ja-JP', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {isUnread && (
                    <span
                      className="mt-2 h-2 w-2 shrink-0 rounded-full bg-terra"
                      aria-label="未読"
                    />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
