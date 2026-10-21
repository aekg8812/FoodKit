import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getUserState } from '@/lib/auth/getUserState'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'
import RestaurantImageForm from './RestaurantImageForm'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function RestaurantImagePage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const [restaurantResult, reviewCountResult] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, source, external_place_id, created_by, main_image_path, main_image_uploaded_by')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', id)
      .eq('user_id', user.id)
      .limit(1),
  ])

  if (restaurantResult.error) {
    throw new Error(`RestaurantImagePage: query failed: ${restaurantResult.error.message}`)
  }
  if (!restaurantResult.data) notFound()

  const r = restaurantResult.data
  const isOwner = r.created_by !== null && r.created_by === user.id
  const isUploader = r.main_image_uploaded_by !== null && r.main_image_uploaded_by === user.id
  const hasReview = (reviewCountResult.count ?? 0) > 0

  // Eligibility: first upload requires no existing image + (owner OR reviewer)
  const canFirstUpload = r.main_image_path === null && (isOwner || hasReview)
  // Replace/delete requires existing image + (owner OR uploader)
  const canManage = r.main_image_path !== null && (isOwner || isUploader)

  if (!canFirstUpload && !canManage) {
    redirect(`/restaurants/${id}`)
  }

  const rDisplay = await resolveRestaurantDisplay(r)

  let currentImageSignedUrl: string | null = null
  if (r.main_image_path) {
    const { data: signedData } = await supabase.storage
      .from('restaurant-images')
      .createSignedUrl(r.main_image_path, 60 * 60)
    currentImageSignedUrl = signedData?.signedUrl ?? null
  }

  return (
    <RestaurantImageForm
      restaurantId={r.id}
      restaurantName={rDisplay.name}
      isGoogleRestaurant={rDisplay.isGoogle}
      currentImagePath={r.main_image_path}
      currentImageSignedUrl={currentImageSignedUrl}
      canManage={canManage}
    />
  )
}
