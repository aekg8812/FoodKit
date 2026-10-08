import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'

type RecRow = {
  restaurant_id: string
  name: string
  area: string | null
  genre: string | null
  budget_per_person_max_yen: number | null
  walk_in_available: boolean | null
  parking_available: boolean | null
  personal_score: number
  evidence_count: number
  followed_evidence_count: number
  similar_evidence_count: number
  rating_4_count: number
  rating_3_count: number
}

function recommendationReason(rec: RecRow): string {
  if (rec.followed_evidence_count > 0 && rec.similar_evidence_count > 0) {
    return 'フォロー中・好みが近い人の記録から'
  }
  if (rec.followed_evidence_count > 0) return 'フォロー中の人の記録から'
  return '好みが近い人の記録から'
}

export default async function RecommendationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const recsResult = await supabase.rpc('get_personal_recommendations_v2', { p_limit: 20 })
  const recs = ((recsResult.data ?? []) as RecRow[])

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <Suspense>
          <BackButton fallbackHref="/home" label="" />
        </Suspense>
        <h1 className="text-base font-bold text-ink">あなたへのおすすめ</h1>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-md px-4 space-y-4">
        <p className="text-xs text-ink-sub">
          フォロー中・好みが近い人の記録をもとに提案しています
        </p>

        {recs.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-5 py-10 text-center">
            <p className="text-sm font-medium text-ink">おすすめを作るための記録がまだ足りません</p>
            <p className="mt-2 text-xs leading-5 text-ink-sub">
              好みカードを5枚以上設定するか、記録を持つユーザーをフォローすると
              おすすめが表示されます。
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link
                href="/mypage/food-preferences/edit"
                className="inline-flex min-h-10 items-center rounded-full border border-terra px-4 text-sm font-semibold text-terra"
              >
                好みを設定する
              </Link>
              <Link
                href="/mypage/follows/search"
                className="inline-flex min-h-10 items-center rounded-full bg-terra px-4 text-sm font-semibold text-white"
              >
                ユーザーを探す
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {recs.map(rec => (
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
                      <p className="mt-1 text-[10px] text-ink-sub">{recommendationReason(rec)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-terra">
                        {Math.round(rec.personal_score * 50)}点
                      </p>
                      <p className="text-[10px] text-ink-sub">{rec.evidence_count}件</p>
                    </div>
                  </div>

                  <div className="mt-2 flex gap-2 text-[10px] text-ink-sub">
                    {rec.followed_evidence_count > 0 && (
                      <span className="rounded-full bg-cream px-2 py-0.5 font-medium text-amber-700">
                        フォロー {rec.followed_evidence_count}件
                      </span>
                    )}
                    {rec.similar_evidence_count > 0 && (
                      <span className="rounded-full bg-cream px-2 py-0.5 font-medium text-amber-700">
                        好み近い {rec.similar_evidence_count}件
                      </span>
                    )}
                    {rec.rating_4_count > 0 && (
                      <span className="rounded-full bg-cream px-2 py-0.5 font-medium text-amber-700">
                        ★4: {rec.rating_4_count}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
