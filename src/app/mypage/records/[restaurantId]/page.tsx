import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { createClient } from '@/lib/supabase/server'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'
import { RATING_BG, RATING_TEXT, RATING_BORDER, RATING_INNER_BG } from '@/lib/rating/colors'

type VisitRow = {
  id: string
  visit_date: string | null
  rating: number
  image_path: string | null
  comment: string | null
  reason_keys: string[]
  label_keys: string[]
  created_at: string
}

type RestaurantRow = {
  id: string
  name: string | null
  source: string
  external_place_id: string | null
  genre: string | null
  area: string | null
  address: string | null
}

type PageProps = {
  params: Promise<{ restaurantId: string }>
}

const RATING_CHIP: Record<number, { label: string; bg: string; text: string; border: string; innerBg: string }> = {
  4: { label: '常連になりたい', bg: RATING_BG[4], text: RATING_TEXT[4], border: RATING_BORDER[4], innerBg: RATING_INNER_BG[4] },
  3: { label: 'また行きたい',   bg: RATING_BG[3], text: RATING_TEXT[3], border: RATING_BORDER[3], innerBg: RATING_INNER_BG[3] },
  2: { label: '一度で十分',     bg: RATING_BG[2], text: RATING_TEXT[2], border: RATING_BORDER[2], innerBg: RATING_INNER_BG[2] },
  1: { label: '二度と行かない', bg: RATING_BG[1], text: RATING_TEXT[1], border: RATING_BORDER[1], innerBg: RATING_INNER_BG[1] },
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`
}

export default async function RestaurantVisitListPage({ params }: PageProps) {
  const { restaurantId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // Load restaurant info
  const { data: restaurantData } = await supabase
    .from('restaurants')
    .select('id, name, source, external_place_id, genre, area, address')
    .eq('id', restaurantId)
    .maybeSingle()

  if (!restaurantData) notFound()

  const restaurant = restaurantData as RestaurantRow
  const restaurantDisplay = await resolveRestaurantDisplay(restaurant)

  // Load all visits for this restaurant, owned by this user
  // RLS (visits_select_own) enforces user_id = auth.uid()
  const { data: visitsData, error: visitsError } = await supabase
    .from('restaurant_visits')
    .select('id, visit_date, rating, image_path, comment, reason_keys, label_keys, created_at')
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurantId)
    .order('visit_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (visitsError) {
    throw new Error(`RestaurantVisitListPage: failed to load visits: ${visitsError.message}`)
  }

  const visits = (visitsData ?? []) as VisitRow[]

  if (visits.length === 0) {
    // No visits for this restaurant (may have all been deleted) → back to records
    redirect('/mypage/records')
  }

  // Sign visit images
  const imagePaths = [...new Set(visits.map(v => v.image_path).filter((p): p is string => Boolean(p)))]
  const signedUrls = new Map<string, string | null>()
  if (imagePaths.length > 0) {
    const { data } = await supabase.storage.from('review-images').createSignedUrls(imagePaths, 60 * 60)
    for (const s of data ?? []) {
      if (s.path) signedUrls.set(s.path, s.signedUrl)
    }
  }

  const repVisit = visits[0]  // first = representative (newest)

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="relative flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref="/mypage/records" label="" />
        </Suspense>
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-base font-bold text-ink">来店履歴</h1>
        <div className="ml-auto w-10" />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Restaurant card */}
        <Link
          href={`/restaurants/${restaurantId}`}
          className="flex items-center gap-3 overflow-hidden rounded-2xl border border-edge bg-surface p-3"
        >
          <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-xl bg-[#F3E5D8]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink" translate={restaurantDisplay.isGoogle ? 'no' : undefined}>
              {restaurantDisplay.name}
            </p>
            {(restaurant.genre || restaurant.area) && (
              <p className="text-xs text-ink-sub">
                {[restaurant.genre, restaurant.area].filter(Boolean).join('・')}
              </p>
            )}
          </div>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
            <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        {/* Visit count + current rating */}
        <div className="flex items-center gap-3">
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${RATING_CHIP[repVisit.rating].innerBg}`}>
            <span className={`text-sm font-bold ${RATING_CHIP[repVisit.rating].text}`}>
              {RATING_CHIP[repVisit.rating].label}
            </span>
          </div>
          <span className="text-sm text-ink-sub">
            <span className="font-bold text-ink">{visits.length}</span>回来店
          </span>
        </div>

        {/* New visit CTA */}
        <Link
          href={`/record/${restaurantId}`}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-terra text-sm font-bold text-terra"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          新しい来店を記録
        </Link>

        {/* Visit history list */}
        <div>
          <h2 className="mb-2 text-sm font-bold text-ink-sub">来店履歴（新しい順）</h2>
          <div className="divide-y divide-edge overflow-hidden rounded-2xl bg-surface">
            {visits.map((visit, index) => {
              const isRep = index === 0
              const chip = RATING_CHIP[visit.rating]
              const imgUrl = visit.image_path
                ? (signedUrls.get(visit.image_path) ?? null)
                : null
              const dateStr = visit.visit_date
                ? formatDate(visit.visit_date)
                : formatDate(visit.created_at)

              return (
                <Link
                  key={visit.id}
                  href={`/visits/${visit.id}`}
                  className="flex items-start gap-3 p-4 hover:bg-canvas"
                >
                  {/* Photo or placeholder */}
                  {imgUrl ? (
                    <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={imgUrl}
                        alt={dateStr}
                        fill
                        sizes="72px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-canvas">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                  )}

                  {/* Visit info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-ink-sub">{dateStr}</p>
                      {isRep && (
                        <span className="rounded-full bg-edge px-2 py-0.5 text-[10px] font-bold text-ink-sub">
                          最新
                        </span>
                      )}
                    </div>
                    <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${chip.bg} ${chip.text} ${chip.border}`}>
                      {chip.label}
                    </span>
                    {visit.comment && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-sub">
                        {visit.comment}
                      </p>
                    )}
                  </div>

                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="mt-1 shrink-0 text-ink-sub" aria-hidden="true">
                    <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
