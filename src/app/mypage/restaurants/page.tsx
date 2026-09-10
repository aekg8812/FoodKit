import Link from 'next/link'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import RegisteredRestaurantsClient, {
  type RegisteredRestaurantRow,
} from './RegisteredRestaurantsClient'

type RecordedRestaurantAccessRow = {
  created_at: string
  restaurants: Omit<RegisteredRestaurantRow, 'created_at'> | null
}

export default async function RegisteredRestaurantsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // 記録店舗ページ: 本人のprivateアクセスがある店舗を専用一覧へ渡す
  const { data, error } = await supabase
    .from('restaurant_accesses')
    .select('created_at, restaurants(id, name, area, genre)')
    .eq('visibility', 'private')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`RegisteredRestaurantsPage: failed to load restaurants: ${error.message}`)
  }

  const restaurants = ((data ?? []) as unknown as RecordedRestaurantAccessRow[])
    .filter(
      (access): access is RecordedRestaurantAccessRow & {
        restaurants: Omit<RegisteredRestaurantRow, 'created_at'>
      } => access.restaurants !== null,
    )
    .map((access) => ({ ...access.restaurants, created_at: access.created_at }))

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <div className="mx-auto max-w-md">
        <Link
          href="/mypage"
          className="mb-5 inline-flex min-h-[44px] items-center text-sm font-medium text-ink-sub transition-colors hover:text-ink"
        >
          ← マイページに戻る
        </Link>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">記録している店舗</h1>
            <p className="mt-1 text-sm leading-relaxed text-ink-sub">
              自分の記録に追加した店舗を確認できます
            </p>
          </div>
          <Link
            href="/restaurants/search"
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-full bg-terra px-4 text-sm font-medium text-white transition-colors hover:bg-terra-deep"
          >
            ＋ 店舗を追加
          </Link>
        </div>

        <RegisteredRestaurantsClient restaurants={restaurants} />
      </div>
      <BottomNav />
    </main>
  )
}
