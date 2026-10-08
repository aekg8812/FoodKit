import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
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
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Link
          href={`/groups/${groupId}`}
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-sub hover:bg-edge"
          aria-label="戻る"
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
            <path d="M9 1L1 9l8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-ink">みんなにおすすめのお店</h1>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-md px-4 pt-4 space-y-4">

        {/* Group card */}
        <Link
          href={`/groups/${groupId}`}
          className="flex items-center gap-4 rounded-2xl border border-edge bg-surface p-4"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F3E5D8]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{groupResult.data.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-sub">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {memberCount}人の好みをもとにおすすめ
            </p>
          </div>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
            <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        {/* Info banner */}
        <div className="rounded-xl bg-terra/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-terra">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            このグループの好みをもとにおすすめしています
          </p>
          <div className="mt-1.5 flex items-end justify-between gap-2">
            <p className="text-xs leading-relaxed text-terra/80">
              メンバーの好みや過去の記録をもとに、みんなにぴったりのお店を選んでいます。
            </p>
            <Link
              href={`/groups/${groupId}/recommendations/conditions`}
              className="shrink-0 text-xs font-bold text-terra whitespace-nowrap"
            >
              条件を指定する ›
            </Link>
          </div>
        </div>

        {/* Content */}
        {recommendations.length === 0 && validMemberCount === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center">
            <p className="text-sm font-medium text-ink">メンバーの食の好みデータがまだ足りません</p>
            <p className="mt-2 text-xs leading-5 text-ink-sub">
              グループメンバーがFoodKitで5枚以上の好みカードを設定すると、グループのおすすめが表示されます。
            </p>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center">
            <p className="text-sm font-medium text-ink">おすすめが見つかりませんでした</p>
            <p className="mt-2 text-xs leading-5 text-ink-sub">
              グループのメンバーが似た好みの人のレビューがある飲食店が見つかりませんでした。
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-ink">
                おすすめ <span className="text-terra">{recommendations.length}</span>件
              </p>
            </div>

            <ul className="space-y-3">
              {recommendations.map((rec) => (
                <li key={rec.restaurant_id}>
                  <Link
                    href={`/restaurants/${rec.restaurant_id}`}
                    className="block overflow-hidden rounded-2xl border border-edge bg-surface transition-colors hover:bg-canvas"
                  >
                    <div className="flex gap-3 p-3">
                      {/* Photo placeholder */}
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                          <line x1="6" y1="1" x2="6" y2="4" />
                          <line x1="10" y1="1" x2="10" y2="4" />
                          <line x1="14" y1="1" x2="14" y2="4" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-ink">{rec.name}</p>
                        {(rec.genre ?? rec.area) && (
                          <p className="mt-0.5 text-xs text-ink-sub">
                            {[rec.genre, rec.area].filter(Boolean).join('・')}
                          </p>
                        )}
                        {rec.budget_per_person_max_yen && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-sub">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M9 12h6M9 8h6M12 16v-8" />
                            </svg>
                            〜¥{rec.budget_per_person_max_yen.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="mt-1 shrink-0 text-ink-sub" aria-hidden="true">
                        <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {/* Match section */}
                    <div className="bg-terra/10 px-3 pb-3 pt-2">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-terra">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        {memberCount}人中{rec.coverage_count}人の好みに合っています
                      </p>
                      {rec.review_evidence_count > 0 && (
                        <p className="mt-1 text-xs text-terra/80">
                          {rec.review_evidence_count}人が高評価を記録
                        </p>
                      )}
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
