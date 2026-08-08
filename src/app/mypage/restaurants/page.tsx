import Link from 'next/link'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import RegisteredRestaurantsClient, {
  type RegisteredRestaurantRow,
} from './RegisteredRestaurantsClient'

export default async function RegisteredRestaurantsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase)
  if (state === 'no_group') redirect('/groups/join')
  if (state === 'no_onboarding') redirect('/onboarding')

  // 登録店舗履歴ページ: 本人が追加した店舗を専用一覧へ渡す
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, area, genre, created_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`RegisteredRestaurantsPage: failed to load restaurants: ${error.message}`)
  }

  const restaurants = (data ?? []) as RegisteredRestaurantRow[]

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
            <h1 className="text-2xl font-bold text-ink">登録した店舗</h1>
            <p className="mt-1 text-sm leading-relaxed text-ink-sub">
              FoodKitに追加した店舗情報を確認できます
            </p>
          </div>
          <Link
            href="/restaurants/new"
            className="inline-flex min-h-[44px] shrink-0 items-center rounded-full bg-terra px-4 text-sm font-medium text-white transition-colors hover:bg-terra-deep"
          >
            ＋ 登録
          </Link>
        </div>

        <RegisteredRestaurantsClient restaurants={restaurants} />
      </div>
      <BottomNav />
    </main>
  )
}
