'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

type ReviewDetail = {
  id: string
  rating: number
  restaurant_name: string | null
}

type ProcessedNotification = NotificationRow & {
  subject: ProfileRow | null
  reviewDetail: ReviewDetail | null
}

type TabValue = 'all' | 'unread'

const RATING_CHIP: Record<number, { label: string; bg: string; text: string; icon: string }> = {
  4: { label: '常連になりたい', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '👑' },
  3: { label: 'また行きたい', bg: 'bg-pink-50', text: 'text-[#E05C7A]', icon: '❤' },
  2: { label: '一度で十分', bg: 'bg-sky-50', text: 'text-sky-600', icon: '🍴' },
  1: { label: '二度と行かない', bg: 'bg-zinc-100', text: 'text-zinc-600', icon: '🚫' },
}

function notificationMessage(n: ProcessedNotification): string {
  const name = n.subject?.name ?? n.subject?.username ?? 'ユーザー'
  if (n.type === 'followed_user') return `${name}さんをフォローしました`
  if (n.type === 'followed_by_user') return `${name}さんがあなたをフォローしました`
  if (n.type === 'group_member_review') {
    const restaurantName = n.reviewDetail?.restaurant_name
    if (restaurantName) return `${name}さんが「${restaurantName}」を記録しました`
    return `${name}さんが新しい記録を追加しました`
  }
  return ''
}

function notificationHref(n: ProcessedNotification): string {
  if (n.type === 'group_member_review' && n.review_id) return `/records/${n.review_id}`
  if (n.subject?.username) return `/users/${n.subject.username}`
  return '#'
}

function getDateGroup(createdAt: string): string {
  const d = new Date(createdAt)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const notifDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (notifDay.getTime() === today.getTime()) return '今日'
  if (notifDay.getTime() === yesterday.getTime()) return '昨日'
  return 'それ以前'
}

function formatRelativeTime(createdAt: string): string {
  const now = Date.now()
  const then = new Date(createdAt).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)
  if (mins < 1) return 'たった今'
  if (mins < 60) return `${mins}分前`
  if (hours < 24) return `${hours}時間前`
  if (days === 1) return '昨日'
  if (days < 7) return `${days}日前`
  const d = new Date(createdAt)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

type ReviewRow = {
  id: string
  rating: number
  restaurants: { name: string } | null
}

type Props = {
  supabaseUrl: string
}

export default function NotificationsClient({ supabaseUrl }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab: TabValue = rawTab === 'unread' ? 'unread' : 'all'

  const [notifications, setNotifications] = useState<ProcessedNotification[]>([])
  const [loading, setLoading] = useState(true)

  function setTab(t: TabValue) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', t)
    router.replace(`/notifications?${params.toString()}`)
  }

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
      const reviewIds = [
        ...new Set(
          rows
            .filter(n => n.type === 'group_member_review' && n.review_id)
            .map(n => n.review_id as string)
        ),
      ]

      const [profileResult, reviewResult] = await Promise.all([
        subjectIds.length > 0
          ? supabase.from('user_public_profiles').select('id, username, name, avatar_path').in('id', subjectIds)
          : { data: [] },
        reviewIds.length > 0
          ? supabase.from('reviews').select('id, rating, restaurants(name)').in('id', reviewIds)
          : { data: [] },
      ])

      if (cancelled) return

      const profileMap = new Map(
        ((profileResult.data ?? []) as ProfileRow[]).map(p => [p.id, p])
      )
      const reviewMap = new Map(
        ((reviewResult.data ?? []) as unknown as ReviewRow[]).map(r => [
          r.id,
          {
            id: r.id,
            rating: r.rating,
            restaurant_name: r.restaurants?.name ?? null,
          } as ReviewDetail,
        ])
      )

      setNotifications(
        rows.map(n => ({
          ...n,
          subject: profileMap.get(n.subject_user_id) ?? null,
          reviewDetail: n.review_id ? (reviewMap.get(n.review_id) ?? null) : null,
        }))
      )
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  function handleClick(n: ProcessedNotification) {
    if (n.read_at) return
    const supabase = createClient()
    supabase.rpc('mark_notification_read', { p_notification_id: n.id }).then(() => {
      setNotifications(prev =>
        prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)
      )
    })
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

  // Group by date
  const dateGroups: { label: string; items: ProcessedNotification[] }[] = []
  const groupOrder: string[] = []
  const groupMap = new Map<string, ProcessedNotification[]>()
  for (const n of displayed) {
    const group = getDateGroup(n.created_at)
    if (!groupMap.has(group)) {
      groupMap.set(group, [])
      groupOrder.push(group)
    }
    groupMap.get(group)!.push(n)
  }
  for (const label of groupOrder) {
    dateGroups.push({ label, items: groupMap.get(label)! })
  }

  return (
    <>
      {/* Page header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-sub hover:bg-edge"
          aria-label="戻る"
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
            <path d="M9 1L1 9l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="flex-1 text-center text-base font-bold text-ink">通知</h1>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="w-[72px] text-right text-xs font-medium text-terra"
          >
            すべて既読
          </button>
        ) : (
          <div className="w-[72px]" />
        )}
      </div>

      {/* Tabs — underline style */}
      <div className="flex border-b border-edge bg-canvas">
        {(['all', 'unread'] as TabValue[]).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              'flex-1 py-3 text-sm font-bold transition-colors',
              tab === t
                ? 'border-b-2 border-terra text-terra'
                : 'border-b-2 border-transparent text-ink-sub hover:text-ink',
            ].join(' ')}
          >
            {t === 'all' ? 'すべて' : `未読${unreadCount > 0 ? `（${unreadCount}）` : ''}`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mx-auto max-w-md">
        {loading ? (
          <div className="py-12 text-center text-sm text-ink-sub">読み込み中…</div>
        ) : displayed.length === 0 ? (
          <div className="mx-4 mt-4 rounded-2xl border border-edge bg-surface px-5 py-12 text-center">
            <p className="text-sm text-ink-sub">
              {tab === 'unread' ? '未読の通知はありません' : '通知はまだありません'}
            </p>
          </div>
        ) : (
          <div className="pb-4">
            {dateGroups.map(group => (
              <div key={group.label}>
                <p className="px-4 pt-4 pb-2 text-sm font-bold text-ink">{group.label}</p>
                <div className="divide-y divide-edge bg-surface">
                  {group.items.map(n => {
                    const href = notificationHref(n)
                    const message = notificationMessage(n)
                    const isUnread = !n.read_at
                    const avatarPath = n.subject?.avatar_path
                    const avatarUrl = avatarPath
                      ? `${supabaseUrl}/storage/v1/object/public/avatars/${avatarPath}`
                      : null
                    const initial = Array.from(
                      (n.subject?.name ?? n.subject?.username ?? '?').trim()
                    )[0] ?? '?'
                    const chip = n.reviewDetail ? RATING_CHIP[n.reviewDetail.rating] : null

                    return (
                      <Link
                        key={n.id}
                        href={href}
                        onClick={() => handleClick(n)}
                        className={`flex min-h-[64px] items-start gap-3 px-4 py-3 transition-colors hover:bg-canvas ${isUnread ? 'bg-[#FFF8F2]' : ''}`}
                      >
                        {/* Unread dot */}
                        <span className={`mt-3 h-2 w-2 shrink-0 rounded-full ${isUnread ? 'bg-terra' : 'bg-transparent'}`} aria-label={isUnread ? '未読' : undefined} />

                        {/* Avatar */}
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt={n.subject?.name ?? ''}
                            width={40}
                            height={40}
                            className="h-10 w-10 shrink-0 rounded-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-edge text-sm font-bold text-ink-sub">
                            {initial}
                          </span>
                        )}

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm leading-5 ${isUnread ? 'font-medium text-ink' : 'text-ink-sub'}`}>
                            {message}
                          </p>
                          {chip && (
                            <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${chip.bg} ${chip.text}`}>
                              <span aria-hidden="true">{chip.icon}</span>
                              {chip.label}
                            </span>
                          )}
                          <p className="mt-0.5 text-[11px] text-ink-sub">
                            {formatRelativeTime(n.created_at)}
                          </p>
                        </div>

                        {/* Chevron */}
                        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="mt-3 shrink-0 text-ink-sub" aria-hidden="true">
                          <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
