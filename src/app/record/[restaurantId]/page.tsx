import { notFound, redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'
import RecordFormClient, { type ExistingReview } from './RecordFormClient'

type Restaurant = {
  id: string
  name: string | null
  source: string
  external_place_id: string | null
  area: string | null
  genre: string | null
  address: string | null
}

type RestaurantForForm = {
  id: string
  name: string
  area: string | null
  genre: string | null
  address: string | null
}

type RecordPageProps = {
  params: Promise<{ restaurantId: string }>
}

export default async function RecordPage({ params }: RecordPageProps) {
  const { restaurantId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/record/[restaurantId]', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data: restaurantData, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, name, source, external_place_id, area, genre, address')
    .eq('id', restaurantId)
    .maybeSingle()

  if (restaurantError) {
    throw new Error(`RecordPage: failed to load restaurant: ${restaurantError.message}`)
  }
  if (!restaurantData) notFound()

  const restaurant = restaurantData as Restaurant
  const display = await resolveRestaurantDisplay(restaurant)
  const restaurantForForm: RestaurantForForm = {
    id: restaurant.id,
    name: display.name,
    area: restaurant.area,
    genre: restaurant.genre,
    address: display.address ?? restaurant.address,
  }

  const { data: canRecord, error: canRecordError } = await supabase.rpc(
    'can_record_restaurant',
    { p_restaurant_id: restaurantId },
  )

  if (canRecordError) {
    throw new Error(`RecordPage: failed to check record permission: ${canRecordError.message}`)
  }
  if (!canRecord) redirect('/record')

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
    <main className="min-h-screen bg-canvas pb-24">
      <RecordFormClient
        restaurantId={restaurantId}
        restaurant={restaurantForForm}
        existingReview={existingReview}
      />
      <BottomNav />
    </main>
  )
}
