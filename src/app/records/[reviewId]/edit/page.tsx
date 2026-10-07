import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import ReviewForm, { type ExistingReview } from '@/app/restaurants/[id]/ReviewForm'

type PageProps = {
  params: Promise<{ reviewId: string }>
}

export default async function RecordEditPage({ params }: PageProps) {
  const { reviewId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data: reviewData, error: reviewError } = await supabase
    .from('reviews')
    .select('id, rating, comment, visit_date, image_path, user_id, restaurant_id, restaurants(id, name)')
    .eq('id', reviewId)
    .maybeSingle()

  if (reviewError) {
    throw new Error(`RecordEditPage: review query failed: ${reviewError.message}`)
  }
  if (!reviewData) notFound()

  type ReviewRow = {
    id: string
    rating: number
    comment: string | null
    visit_date: string | null
    image_path: string | null
    user_id: string
    restaurant_id: string
    restaurants: { id: string; name: string } | null
  }

  const review = reviewData as unknown as ReviewRow

  // Ownership check — redirect unauthorized access back to detail
  if (review.user_id !== user.id) {
    redirect(`/records/${reviewId}`)
  }

  // Signed URL for existing image
  let imageUrl: string | null = null
  if (review.image_path) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from('review-images')
      .createSignedUrl(review.image_path, 60 * 60)
    if (signedError) {
      console.error('RecordEditPage: failed to sign review image', signedError)
    } else {
      imageUrl = signedData?.signedUrl ?? null
    }
  }

  const existingReview: ExistingReview = {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    visit_date: review.visit_date,
    image_path: review.image_path,
    image_url: imageUrl,
  }

  const restaurant = review.restaurants

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 pb-24">
      <div className="mx-auto max-w-md space-y-5">
        <Suspense>
          <BackButton fallbackHref={`/records/${reviewId}`} />
        </Suspense>

        <div>
          <h1 className="text-2xl font-bold text-ink">記録を編集</h1>
          {restaurant && (
            <p className="mt-1 text-sm text-ink-sub">{restaurant.name}</p>
          )}
        </div>

        <ReviewForm
          restaurantId={review.restaurant_id}
          existingReview={existingReview}
          successRedirectHref={`/records/${reviewId}`}
          submitLabel="保存する"
        />

        {/* Cancel */}
        <div className="pt-1 text-center">
          <a
            href={`/records/${reviewId}`}
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-ink-sub hover:text-ink"
          >
            キャンセル
          </a>
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
