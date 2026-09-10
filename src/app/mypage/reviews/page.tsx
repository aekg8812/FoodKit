import Link from 'next/link'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import ReviewHistoryClient, { type ReviewHistoryRow } from './ReviewHistoryClient'

export default async function ReviewHistoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // レビュー履歴ページ: 本人のレビューだけを新しい順ですべて取得する
  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, comment, visit_date, created_at, restaurant_id, image_path, restaurants(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`ReviewHistoryPage: failed to load reviews: ${error.message}`)
  }

  const reviewRows = (data ?? []) as unknown as Omit<ReviewHistoryRow, 'image_url'>[]

  // レビュー画像: 本人の履歴に表示するため、非公開画像の署名付きURLを発行する
  const imagePaths = [
    ...new Set(
      reviewRows
        .map((review) => review.image_path)
        .filter((path): path is string => Boolean(path)),
    ),
  ]
  const signedImagesResult = imagePaths.length
    ? await supabase.storage.from('review-images').createSignedUrls(imagePaths, 60 * 60)
    : { data: [], error: null }

  if (signedImagesResult.error) {
    console.error('ReviewHistoryPage: failed to sign review images', signedImagesResult.error)
  }

  const signedImageUrls = new Map<string, string | null>()
  for (const signedImage of signedImagesResult.data ?? []) {
    if (signedImage.error) {
      console.error('ReviewHistoryPage: failed to sign review image', {
        path: signedImage.path,
        message: signedImage.error,
      })
    }
    if (signedImage.path) signedImageUrls.set(signedImage.path, signedImage.signedUrl)
  }

  const reviews: ReviewHistoryRow[] = reviewRows.map((review) => ({
    ...review,
    image_url: review.image_path ? signedImageUrls.get(review.image_path) ?? null : null,
  }))

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <div className="mx-auto max-w-md">
        <Link
          href="/mypage"
          className="mb-5 inline-flex min-h-[44px] items-center text-sm font-medium text-ink-sub transition-colors hover:text-ink"
        >
          ← マイページに戻る
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">レビュー履歴</h1>
          <p className="mt-1 text-sm text-ink-sub">これまでに投稿した食事の記録</p>
        </div>

        {/* レビュー履歴UI: 検索・評価・並び替えをクライアント側で提供する */}
        <ReviewHistoryClient reviews={reviews} />
      </div>
      <BottomNav />
    </main>
  )
}
