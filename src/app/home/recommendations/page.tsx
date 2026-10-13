import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import RestaurantMainImage from '@/components/RestaurantMainImage'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'

type RecRow = {
  restaurant_id: string
  name: string | null
  source: string
  external_place_id: string | null
  area: string | null
  genre: string | null
  main_image_path: string | null
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

  // Resolve display names for Google-sourced restaurants
  const recDisplayNames = new Map<string, string>()
  await Promise.all(
    recs
      .filter(r => r.source === 'google_place' && r.external_place_id)
      .map(async (rec) => {
        const d = await resolveRestaurantDisplay(rec)
        recDisplayNames.set(rec.restaurant_id, d.name)
      }),
  )

  // Generate signed URLs for restaurant main images (private bucket)
  const recImagePaths = recs
    .map((r) => r.main_image_path)
    .filter((p): p is string => Boolean(p))
  const recImageSignedUrls = new Map<string, string>()
  if (recImagePaths.length > 0) {
    const { data } = await supabase.storage
      .from('restaurant-images')
      .createSignedUrls(recImagePaths, 60 * 60)
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) {
        recImageSignedUrls.set(item.path, item.signedUrl)
      }
    }
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref="/home" label="" />
        </Suspense>
        <h1 className="flex-1 text-center text-base font-bold text-ink">あなたへのおすすめ</h1>
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
                className="inline-flex min-h-10 items-center rounded-xl bg-terra px-4 text-sm font-semibold text-white"
              >
                ユーザーを探す
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {recs.map(rec => {
              const imageUrl = rec.main_image_path
                ? (recImageSignedUrls.get(rec.main_image_path) ?? null)
                : null
              return (
                <li key={rec.restaurant_id}>
                  <Link
                    href={`/restaurants/${rec.restaurant_id}`}
                    className="flex overflow-hidden rounded-2xl border border-edge bg-surface shadow-sm transition-colors hover:bg-canvas"
                  >
                    {/* Left: restaurant main image */}
                    <div className="relative h-[100px] w-[90px] shrink-0 overflow-hidden">
                      <RestaurantMainImage src={imageUrl} alt={recDisplayNames.get(rec.restaurant_id) ?? rec.name ?? '—'} />
                    </div>

                    {/* Right: info */}
                    <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
                      <div>
                        <p className="truncate font-semibold text-ink">
                          {recDisplayNames.get(rec.restaurant_id) ?? rec.name ?? '—'}
                        </p>
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

                      <div>
                        <p className="text-[10px] text-ink-sub">{recommendationReason(rec)}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                          {rec.followed_evidence_count > 0 && (
                            <span className="rounded-full bg-terra/10 px-2 py-0.5 font-medium text-terra">
                              フォロー {rec.followed_evidence_count}件
                            </span>
                          )}
                          {rec.similar_evidence_count > 0 && (
                            <span className="rounded-full bg-terra/10 px-2 py-0.5 font-medium text-terra">
                              好み近い {rec.similar_evidence_count}件
                            </span>
                          )}
                          {rec.rating_4_count > 0 && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                              ★4: {rec.rating_4_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
