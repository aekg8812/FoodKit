import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import GroupMenu, { type GroupMenuMember } from '@/components/groups/GroupMenu'
import Card from '@/components/ui/Card'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'

type GroupRow = {
  id: string
  name: string
  invite_code: string
}

type MemberRow = {
  group_id: string
  user_id: string
  users: { name: string } | null
}

type ValueProfileRow = {
  user_id: string
  main_value_type: string | null
}

type SharedRestaurant = {
  id: string
  name: string
  area: string | null
  genre: string | null
  created_at: string
}

type RestaurantAccessRow = {
  created_at: string
  restaurants: SharedRestaurant | null
}

type GroupDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function GroupDetailPage({ params }: GroupDetailPageProps) {
  const { id: groupId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/groups/[id]', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [groupResult, membersResult, accessesResult] = await Promise.all([
    supabase.from('groups').select('id, name, invite_code').eq('id', groupId).maybeSingle(),
    supabase
      .from('group_members')
      .select('group_id, user_id, users:user_public_profiles(name)')
      .eq('group_id', groupId),
    supabase
      .from('restaurant_accesses')
      .select('created_at, restaurants(id, name, area, genre, created_at)')
      .eq('group_id', groupId)
      .eq('visibility', 'group')
      .order('created_at', { ascending: false }),
  ])

  if (groupResult.error) {
    console.error('GroupDetailPage: failed to load group', groupResult.error)
    throw new Error('グループ情報を読み込めませんでした。')
  }
  if (!groupResult.data) notFound()

  if (membersResult.error) {
    console.error('GroupDetailPage: failed to load members', membersResult.error)
    throw new Error('メンバー情報を読み込めませんでした。')
  }
  if (accessesResult.error) {
    console.error('GroupDetailPage: failed to load shared restaurants', accessesResult.error)
    throw new Error('共有店舗を読み込めませんでした。')
  }

  const group = groupResult.data as GroupRow
  const memberRows = (membersResult.data ?? []) as unknown as MemberRow[]
  const memberIds = memberRows.map((member) => member.user_id)

  let valueProfiles: ValueProfileRow[] = []
  if (memberIds.length > 0) {
    const { data, error } = await supabase
      .from('user_public_value_profiles')
      .select('user_id, main_value_type')
      .in('user_id', memberIds)

    if (error) {
      console.error('GroupDetailPage: failed to load value profiles', error)
      throw new Error('メンバーの価値タイプを読み込めませんでした。')
    }
    valueProfiles = (data ?? []) as ValueProfileRow[]
  }

  const valueTypeByUserId = new Map(
    valueProfiles.map((profile) => [profile.user_id, profile.main_value_type]),
  )
  const members: GroupMenuMember[] = memberRows.map((member) => ({
    id: member.user_id,
    name: member.users?.name ?? '（名前なし）',
    valueType: valueTypeByUserId.get(member.user_id) ?? null,
  }))
  const isCurrentMember = members.some((member) => member.id === user.id)
  const sharedRestaurants = ((accessesResult.data ?? []) as unknown as RestaurantAccessRow[])
    .filter(
      (access): access is RestaurantAccessRow & { restaurants: SharedRestaurant } =>
        access.restaurants !== null,
    )
    .map((access) => access.restaurants)

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/friends?tab=groups"
          className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-ink-sub transition-colors hover:text-ink"
        >
          ← グループ一覧に戻る
        </Link>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium text-ink-sub">グループ</p>
            <h1 className="break-words text-2xl font-bold text-ink">{group.name}</h1>
          </div>
          <GroupMenu
            groupId={group.id}
            groupName={group.name}
            inviteCode={group.invite_code}
            currentUserId={user.id}
            members={members}
            isCurrentMember={isCurrentMember}
          />
        </div>

        <section aria-labelledby="shared-restaurants-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="shared-restaurants-heading" className="text-base font-bold text-ink">
              共有店舗
            </h2>
            <span className="text-sm tabular-nums text-ink-sub">
              {sharedRestaurants.length}件
            </span>
          </div>

          {sharedRestaurants.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-ink-sub">共有されている店舗はありません</p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {sharedRestaurants.map((restaurant) => (
                <li key={restaurant.id}>
                  <Link
                    href={`/restaurants/${restaurant.id}`}
                    prefetch={false}
                    className="block"
                  >
                    <Card interactive className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{restaurant.name}</p>
                          {restaurant.genre || restaurant.area ? (
                            <p className="mt-1 truncate text-sm text-ink-sub">
                              {[restaurant.genre, restaurant.area].filter(Boolean).join(' · ')}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-sm text-ink-sub" aria-hidden="true">
                          →
                        </span>
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <BottomNav />
    </main>
  )
}
