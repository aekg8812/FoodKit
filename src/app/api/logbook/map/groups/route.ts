import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MapGroupInfo } from '@/app/logbook/types'

type GroupRow = {
  id: string
  name: string | null
  group_members: { count: number }[]
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const groupId = req.nextUrl.searchParams.get('groupId')

  if (groupId) {
    // Return stats for a specific group
    // Verify user is a member
    const { data: membership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // Get member count
    const { count: memberCount } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)

    // Own visits stats (group visit sharing not yet implemented)
    const { data: visitRows } = await supabase
      .from('restaurant_visits')
      .select('restaurant_id, visit_date')
      .eq('user_id', user.id)

    const uniqueRestaurantCount = new Set((visitRows ?? []).map((r) => r.restaurant_id)).size
    const totalVisitCount = visitRows?.length ?? 0

    return NextResponse.json({
      memberCount: memberCount ?? 0,
      uniqueRestaurantCount,
      totalVisitCount,
      isGroupSharingLimited: true,
    })
  }

  // Return all groups the user belongs to
  const { data: groupRows, error } = await supabase
    .from('groups')
    .select('id, name, group_members(count)')
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const groups: MapGroupInfo[] = ((groupRows ?? []) as unknown as GroupRow[]).map((g) => ({
    id: g.id,
    name: g.name ?? 'グループ名なし',
    memberCount: g.group_members?.[0]?.count ?? 0,
  }))

  return NextResponse.json({ groups })
}
