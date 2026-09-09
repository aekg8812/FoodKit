import Link from 'next/link'
import Card from '@/components/ui/Card'

export type GroupListItem = {
  id: string
  name: string
}

type GroupsListProps = {
  groups: GroupListItem[]
  errorMessage?: string
}

export default function GroupsList({ groups, errorMessage }: GroupsListProps) {
  if (errorMessage) {
    return (
      <Card className="p-6 text-center">
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      </Card>
    )
  }

  if (groups.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm font-medium text-ink">まだ参加しているグループはありません</p>
        <p className="mt-2 text-sm text-ink-sub">
          グループを作るか、招待コードで参加できます
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link
            href="/groups/join"
            className="flex min-h-11 items-center justify-center rounded-full bg-terra px-4 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            グループを作る
          </Link>
          <Link
            href="/groups/join"
            className="flex min-h-11 items-center justify-center rounded-full border border-edge bg-surface px-4 text-sm font-bold text-ink transition-colors hover:bg-canvas"
          >
            招待コードで参加する
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <section aria-labelledby="group-list-heading">
      <div className="mb-2 flex items-center gap-2">
        <h2 id="group-list-heading" className="text-sm font-bold text-ink">
          参加中のグループ
        </h2>
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-cream px-2 py-0.5 text-xs font-bold text-terra">
          {groups.length}
        </span>
      </div>

      <Card className="divide-y divide-edge overflow-hidden">
        {groups.map((group) => (
          <Link
            key={group.id}
            href={`/groups/${group.id}`}
            className="flex min-h-[60px] items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-lg"
            >
              👥
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{group.name}</p>
            <span className="shrink-0 text-sm text-ink-sub" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </Card>
    </section>
  )
}
