import { notFound, redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import ReviewForm, { type ExistingReview } from '@/app/restaurants/[id]/ReviewForm'

type Restaurant = {
  id: string
  name: string
  area: string | null
  genre: string | null
}

type RecordPageProps = {
  params: Promise<{ restaurantId: string }>
}

export default async function RecordPage({ params }: RecordPageProps) {
  const { restaurantId } = await params
  const supabase = await createClient()

  // 1. 認証確認
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/record/[restaurantId]', Boolean(user))
  if (!user) redirect('/login')

  // 2. onboarding確認
  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // 3. 店舗取得
  const { data: restaurantData, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, name, area, genre')
    .eq('id', restaurantId)
    .maybeSingle()

  if (restaurantError) {
    throw new Error(`RecordPage: failed to load restaurant: ${restaurantError.message}`)
  }
  if (!restaurantData) notFound()

  const restaurant = restaurantData as Restaurant

  // 4. 記録権限確認（DBは書き換えない）
  const { data: canRecord, error: canRecordError } = await supabase.rpc(
    'can_record_restaurant',
    { p_restaurant_id: restaurantId },
  )

  if (canRecordError) {
    throw new Error(`RecordPage: failed to check record permission: ${canRecordError.message}`)
  }
  if (!canRecord) redirect('/record')

  // 5. 既存レビューを取得（user_id と restaurant_id を明示）
  const { data: existingReviewRow, error: existingReviewError } = await supabase
    .from('reviews')
    .select('id, rating, comment, visit_date, image_path')
    .eq('restaurant_id', restaurantId)
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (existingReviewError) {
    throw new Error(`RecordPage: failed to load existing review: ${existingReviewError.message}`)
  }

  // 6. 既存画像があれば署名URL取得
  const imagePath = existingReviewRow?.image_path ?? null
  let imageUrl: string | null = null

  if (imagePath) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from('review-images')
      .createSignedUrls([imagePath], 60 * 60)

    if (signedError) {
      console.error('RecordPage: failed to sign review image', signedError)
    } else {
      const signed = signedData?.[0]
      if (signed && !signed.error) {
        imageUrl = signed.signedUrl
      }
    }
  }

  const existingReview: ExistingReview | null = existingReviewRow
    ? { ...existingReviewRow, image_url: imageUrl }
    : null

  return (
    <main className="min-h-screen bg-canvas px-6 pt-6 pb-24">
      <div className="mx-auto w-full max-w-md">
        <PageHeader
          title="記録する"
          back={{ href: `/restaurants/${restaurantId}` }}
        />

        {/* 対象店舗 */}
        <div className="mt-4 rounded-2xl border border-edge bg-surface px-5 py-4 shadow-sm">
          <p className="text-xs font-medium text-ink-sub">対象店舗</p>
          <p className="mt-1 font-bold text-ink">{restaurant.name}</p>
          {(restaurant.area || restaurant.genre) && (
            <p className="mt-0.5 text-sm text-ink-sub">
              {[restaurant.area, restaurant.genre].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* 記録フォーム */}
        <div className="mt-4 rounded-2xl border border-edge bg-surface p-6 shadow-sm">
          <ReviewForm
            key={existingReview?.id ?? 'new'}
            restaurantId={restaurantId}
            existingReview={existingReview}
            successRedirectHref={`/restaurants/${restaurantId}`}
          />
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
