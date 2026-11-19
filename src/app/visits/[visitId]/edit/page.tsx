import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'
import VisitEditForm, { type VisitForEdit } from './VisitEditForm'

type PageProps = {
  params: Promise<{ visitId: string }>
}

export default async function VisitEditPage({ params }: PageProps) {
  const { visitId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // RLS (visits_select_own) enforces user_id = auth.uid()
  type VisitRow = {
    id: string
    user_id: string
    restaurant_id: string
    visit_date: string | null
    rating: number
    comment: string | null
    image_path: string | null
    reason_keys: string[]
    label_keys: string[]
  }

  const { data: visitData, error: visitError } = await supabase
    .from('restaurant_visits')
    .select('id, user_id, restaurant_id, visit_date, rating, comment, image_path, reason_keys, label_keys')
    .eq('id', visitId)
    .maybeSingle()

  if (visitError) {
    throw new Error(`VisitEditPage: visit query failed: ${visitError.message}`)
  }
  if (!visitData) notFound()

  const visitRow = visitData as VisitRow

  // Signed URL for existing image
  let imageUrl: string | null = null
  if (visitRow.image_path) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from('review-images')
      .createSignedUrl(visitRow.image_path, 60 * 60)
    if (signedError) {
      console.error('VisitEditPage: failed to sign visit image', signedError)
    } else {
      imageUrl = signedData?.signedUrl ?? null
    }
  }

  // Load restaurant info for display
  type RestaurantRow = { id: string; name: string | null; source: string; external_place_id: string | null }
  const { data: restaurantData } = await supabase
    .from('restaurants')
    .select('id, name, source, external_place_id')
    .eq('id', visitRow.restaurant_id)
    .maybeSingle()

  const restaurant = restaurantData as RestaurantRow | null
  const restaurantDisplay = restaurant ? await resolveRestaurantDisplay(restaurant) : null
  const restaurantName = restaurantDisplay?.name ?? '店舗'

  const visit: VisitForEdit = {
    id:          visitRow.id,
    restaurant_id: visitRow.restaurant_id,
    visit_date:  visitRow.visit_date,
    rating:      visitRow.rating,
    comment:     visitRow.comment,
    image_path:  visitRow.image_path,
    image_url:   imageUrl,
    reason_keys: visitRow.reason_keys,
    label_keys:  visitRow.label_keys,
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref={`/visits/${visitId}`} label="" />
        </Suspense>
        <div className="flex-1 text-center">
          <h1 className="text-base font-bold text-ink">来店を編集</h1>
          <p className="text-xs text-ink-sub">{restaurantName}</p>
        </div>
        <div className="w-10" />
      </div>

      <div className="mx-auto max-w-md">
        <VisitEditForm visit={visit} restaurantName={restaurantName} />
      </div>

      <BottomNav />
    </main>
  )
}
