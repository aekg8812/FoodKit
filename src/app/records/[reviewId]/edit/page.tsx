import { notFound, redirect } from 'next/navigation'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'

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
    .select('id, user_id, restaurant_id')
    .eq('id', reviewId)
    .maybeSingle()

  if (reviewError) {
    throw new Error(`RecordEditPage: review query failed: ${reviewError.message}`)
  }
  if (!reviewData) notFound()

  const review = reviewData as { id: string; user_id: string; restaurant_id: string }
  if (review.user_id !== user.id) {
    redirect(`/records/${reviewId}`)
  }

  // Find representative visit (matches upsert_visit representative sort)
  const { data: repVisit } = await supabase
    .from('restaurant_visits')
    .select('id')
    .eq('user_id', user.id)
    .eq('restaurant_id', review.restaurant_id)
    .order('visit_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  const repVisitId = (repVisit as { id: string } | null)?.id ?? null

  if (repVisitId) {
    redirect(`/visits/${repVisitId}/edit`)
  }

  // Fallback: no visit row found (legacy record pre-migration)
  redirect(`/records/${reviewId}`)
}
