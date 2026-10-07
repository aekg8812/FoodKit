import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'

type RecommendationRow = {
  restaurant_id: string
  name: string
  area: string | null
  genre: string | null
  address: string | null
  budget_per_person_max_yen: number | null
  walk_in_available: boolean | null
  parking_available: boolean | null
  coverage_count: number
  valid_member_count: number
  coverage_ratio: number
  group_score: number
  review_evidence_count: number
}

type PrefSummaryRow = {
  valid_member_count: number
}

type GroupRecommendationsPageProps = {
  params: Promise<{ id: string }>
}

function memberCountToPartyTag(count: number): string {
  if (count <= 1) return 'solo'
  if (count === 2) return 'pair'
  if (count <= 4) return 'small_group'
  return 'large_group'
}

export default async function GroupRecommendationsPage({ params }: GroupRecommendationsPageProps) {
  const { id: groupId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [groupResult, membersResult, prefSummaryResult] = await Promise.all([
    supabase.from('groups').select('id, name').eq('id', groupId).maybeSingle(),
    supabase.from('group_members').select('user_id').eq('group_id', groupId),
    supabase.rpc('get_group_preference_summary', { p_group_id: groupId }),
  ])

  if (groupResult.error) throw new Error('グループ情報を読み込めませんでした。')
  if (!groupResult.data) notFound()

  const group = groupResult.data as { id: string; name: string }
  const memberCount = (membersResult.data ?? []).length
  const partyTag = memberCountToPartyTag(memberCount)

  const prefRows = (prefSummaryResult.data ?? []) as PrefSummaryRow[]
  const validMemberCount = prefRows.length > 0 ? Number(prefRows[0].valid_member_count) : 0

  const { data: recData, error: recError } = await supabase.rpc('get_group_recommendations_v2', {
    p_group_id: groupId,
    p_party_tag: partyTag,
    p_limit: 20,
  })

  if (recError) {
    console.error('GroupRecommendationsPage: RPC failed', recError)
    throw new Error('おすすめを読み込めませんでした。')
  }

  const recommendations = (recData ?? []) as RecommendationRow[]

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 pb-20">
      <div className="mx-auto max-w-md space-y-4">
        <Suspense>
          <BackButton fallbackHref={`/groups/${groupId}`} label="← グループに戻る" />
        </Suspense>

        <div>
          <p className="text-xs text-ink-sub">{group.name}</p>
          <h1 className="text-xl font-bold text-ink">グループのおすすめ</h1>
        </div>

        <div className="flex items-center justify-end">
          <Link
            href={`/groups/${groupId}/recommendations/conditions`}
            className="rounded-full border border-terra px-4 py-2 text-xs font-semibold text-terra transition-colors hover:bg-cream"
          >
            条件を絞り込む
          </Link>
        </div>

        {recommendations.length === 0 && validMemberCount === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-ink">
              メンバーの食の好みデータがまだ足りません
            </p>
            <p className="mt-2 text-xs leading-5 text-ink-sub">
              グループメンバーがFoodKitで5枚以上の好みカードを設定すると、
              グループのおすすめが表示されます。
            </p>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-ink">おすすめが見つかりませんでした</p>
            <p className="mt-2 text-xs leading-5 text-ink-sub">
              グループのメンバーが似た好みの人のレビューがある飲食店が見つかりませんでした。
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-ink-sub">{recommendations.length}件のおすすめ</p>
            <ul className="space-y-3">
              {recommendations.map((rec) => (
                <li key={rec.restaurant_id}>
                  <Link
                    href={`/restaurants/${rec.restaurant_id}`}
                    className="block rounded-2xl border border-edge bg-surface p-4 shadow-sm transition-colors hover:bg-canvas"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{rec.name}</p>
                        {(rec.genre ?? rec.area) && (
                          <p className="mt-0.5 truncate text-xs text-ink-sub">
                            {[rec.genre, rec.area].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {rec.budget_per_person_max_yen && (
                          <p className="mt-0.5 text-xs text-ink-sub">
                            〜¥{rec.budget_per_person_max_yen.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-terra">
                          {Math.round(rec.coverage_ratio * 100)}%
                        </p>
                        <p className="text-[10px] text-ink-sub">
                          {rec.coverage_count}/{rec.valid_member_count}人
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
