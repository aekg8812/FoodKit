import Link from 'next/link'
import Card from '@/components/ui/Card'
import FriendRelationshipAction, {
  type FriendRelationshipActionType,
} from './FriendRelationshipAction'

export type FriendProfile = {
  id: string
  username: string
  name: string
}

type FriendsListProps = {
  viewerId: string
  incoming: FriendProfile[]
  mutual: FriendProfile[]
  outgoing: FriendProfile[]
  errorMessage?: string
}

type FriendSectionProps = {
  viewerId: string
  title: string
  profiles: FriendProfile[]
  action: FriendRelationshipActionType
}

function FriendSection({ viewerId, title, profiles, action }: FriendSectionProps) {
  if (profiles.length === 0) return null

  return (
    <section aria-labelledby={`friends-${title}-heading`}>
      <div className="mb-2 flex items-center gap-2">
        <h2 id={`friends-${title}-heading`} className="text-sm font-bold text-ink">
          {title}
        </h2>
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-cream px-2 py-0.5 text-xs font-bold text-terra">
          {profiles.length}
        </span>
      </div>

      <Card className="divide-y divide-edge overflow-hidden">
        {profiles.map((profile) => {
          const initial = Array.from(profile.name.trim())[0] ?? '👤'

          return (
            <div key={profile.id} className="flex min-h-[60px] items-center gap-2 px-4 py-2">
              <Link
                href={`/users/${encodeURIComponent(profile.username)}`}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg transition-colors hover:bg-canvas"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-sm font-bold text-terra"
                >
                  {initial}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{profile.name}</span>
                  <span className="block truncate text-xs text-ink-sub">@{profile.username}</span>
                </span>
              </Link>
              <FriendRelationshipAction
                viewerId={viewerId}
                profile={{ id: profile.id, name: profile.name }}
                action={action}
              />
            </div>
          )
        })}
      </Card>
    </section>
  )
}

export default function FriendsList({
  viewerId,
  incoming,
  mutual,
  outgoing,
  errorMessage,
}: FriendsListProps) {
  if (errorMessage) {
    return (
      <Card className="p-6 text-center">
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      </Card>
    )
  }

  if (incoming.length === 0 && mutual.length === 0 && outgoing.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm font-medium text-ink">まだ友人やフォロー中のユーザーはいません</p>
        <p className="mt-2 text-sm text-ink-sub">
          右上の＋ボタンからユーザーIDを検索できます
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <FriendSection
        viewerId={viewerId}
        title="相手からのフォロー"
        profiles={incoming}
        action="follow-back"
      />
      <FriendSection viewerId={viewerId} title="友人" profiles={mutual} action="remove-friend" />
      <FriendSection
        viewerId={viewerId}
        title="フォロー中（相手の反応待ち）"
        profiles={outgoing}
        action="unfollow"
      />
    </div>
  )
}
