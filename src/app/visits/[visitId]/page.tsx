import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { getUserState } from '@/lib/auth/getUserState'
import { resolveRestaurantDisplay } from '@/lib/restaurants/display'
import { RATING_BG, RATING_TEXT, RATING_INNER_BG, RATING_SVG_HEX } from '@/lib/rating/colors'
import VisitDeleteButton from './VisitDeleteButton'

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
  created_at: string
}

type PageProps = {
  params: Promise<{ visitId: string }>
}

const REASON_LABEL: Record<string, string> = {
  taste: '味',
  value: 'コスパ',
  atmosphere: '雰囲気',
  service: '接客',
  volume: 'ボリューム',
  access: 'アクセス',
}

const LABEL_LABEL: Record<string, string> = {
  solo: 'ひとり向き',
  friends: '友達向き',
  date: 'デート向き',
  large_group: '大人数向き',
  calm: '落ち着く',
  lively: 'にぎやか',
  stylish: 'おしゃれ',
  casual: 'カジュアル',
  quick: 'サクッと利用',
  long_stay: '長居しやすい',
  hearty: 'がっつり',
  photogenic: '写真映え',
}

const RATING_LABEL: Record<number, string> = {
  4: '常連になりたい',
  3: 'また行きたい',
  2: '一度で十分',
  1: '二度と行かない',
}

const RATING_SUBLABEL: Record<number, string> = {
  4: 'ぜひ定期的に通いたいお店',
  3: '機会があればもう一度行きたい',
  2: '一度体験できたので十分',
  1: '残念ながらまた行こうとは思わない',
}

const RATING_STYLE: Record<number, { bg: string; chipBg: string; text: string; subText: string }> = {
  4: { bg: RATING_BG[4], chipBg: RATING_INNER_BG[4], text: RATING_TEXT[4], subText: RATING_TEXT[4] },
  3: { bg: RATING_BG[3], chipBg: RATING_INNER_BG[3], text: RATING_TEXT[3], subText: RATING_TEXT[3] },
  2: { bg: RATING_BG[2], chipBg: RATING_INNER_BG[2], text: RATING_TEXT[2], subText: RATING_TEXT[2] },
  1: { bg: RATING_BG[1], chipBg: RATING_INNER_BG[1], text: RATING_TEXT[1], subText: RATING_TEXT[1] },
}

function RatingIllustration({ rating }: { rating: number }) {
  const c = RATING_SVG_HEX[rating] ?? '#71717A'
  if (rating === 4) return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle cx="26" cy="26" r="22" fill={c} opacity="0.12" />
      <path d="M14 34 L16 20 L22 27 L26 18 L30 27 L36 20 L38 34 Z" fill={c} opacity="0.85" />
      <rect x="13" y="34" width="26" height="3" rx="1.5" fill={c} opacity="0.85" />
    </svg>
  )
  if (rating === 3) return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle cx="26" cy="26" r="22" fill={c} opacity="0.1" />
      <path d="M20 16 L17 28 Q17 32 21 32 L20 38" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.85" fill="none" />
      <path d="M32 16 L35 28 Q35 32 31 32 L32 38" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.85" fill="none" />
      <line x1="18" y1="38" x2="22" y2="38" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      <line x1="30" y1="38" x2="34" y2="38" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      <line x1="26" y1="13" x2="26" y2="11" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="23" y1="14" x2="22" y2="12" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="29" y1="14" x2="30" y2="12" stroke={c} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
  if (rating === 2) return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle cx="26" cy="26" r="22" fill={c} opacity="0.1" />
      <line x1="22" y1="16" x2="22" y2="36" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      <path d="M19 16 L19 24 Q22 26 25 24 L25 16" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" fill="none" />
      <path d="M30 16 Q30 22 30 24 Q32 26 32 28 L32 36" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.8" fill="none" />
    </svg>
  )
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <circle cx="26" cy="26" r="22" fill={c} opacity="0.08" />
      <path d="M26 34 C22 34 18 30 18 26 L18 22 L28 22 L28 18 L32 18 L32 26 C32 26 30 34 26 34Z" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" fill="none" />
    </svg>
  )
}

function formatVisitDate(visitDate: string): string {
  const d = new Date(visitDate)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${days[d.getDay()]})`
}

export default async function VisitDetailPage({ params }: PageProps) {
  const { visitId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  // RLS (visits_select_own) enforces user_id = auth.uid()
  const { data: visitData, error: visitError } = await supabase
    .from('restaurant_visits')
    .select('id, user_id, restaurant_id, visit_date, rating, comment, image_path, reason_keys, label_keys, created_at')
    .eq('id', visitId)
    .maybeSingle()

  if (visitError) {
    throw new Error(`VisitDetailPage: visit query failed: ${visitError.message}`)
  }
  if (!visitData) notFound()

  const visit = visitData as VisitRow

  // Load restaurant info
  type RestaurantRow = { id: string; name: string | null; source: string; external_place_id: string | null; area: string | null; genre: string | null; address: string | null }
  const { data: restaurantData, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, name, source, external_place_id, area, genre, address')
    .eq('id', visit.restaurant_id)
    .maybeSingle()

  if (restaurantError) {
    throw new Error(`VisitDetailPage: restaurant query failed: ${restaurantError.message}`)
  }

  const restaurant = restaurantData as RestaurantRow | null
  const restaurantDisplay = restaurant ? await resolveRestaurantDisplay(restaurant) : null

  // Visit count for this restaurant
  const { count: visitCount } = await supabase
    .from('restaurant_visits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('restaurant_id', visit.restaurant_id)

  // Signed URL for visit image
  let imageUrl: string | null = null
  if (visit.image_path) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from('review-images')
      .createSignedUrl(visit.image_path, 60 * 60)
    if (signedError) {
      console.error('VisitDetailPage: failed to sign visit image', signedError)
    } else {
      imageUrl = signedData?.signedUrl ?? null
    }
  }

  const ratingStyle = RATING_STYLE[visit.rating] ?? RATING_STYLE[3]

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="relative flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref={restaurant ? `/restaurants/${restaurant.id}` : '/mypage/records'} label="" />
        </Suspense>
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-base font-bold text-ink">来店詳細</h1>
        <div className="ml-auto flex items-center">
          <Link
            href={`/visits/${visitId}/edit`}
            className="flex h-11 items-center justify-center px-2 text-sm font-bold text-terra"
          >
            編集
          </Link>
          <VisitDeleteButton
            visitId={visitId}
            restaurantId={visit.restaurant_id}
            imagePath={visit.image_path}
          />
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Visit count badge */}
        {visitCount !== null && visitCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-terra/10 px-3 py-1 text-xs font-bold text-terra">
              この店舗への来店 {visitCount}回
            </span>
          </div>
        )}

        {/* Restaurant card */}
        {restaurant && restaurantDisplay && (
          <Link
            href={`/restaurants/${restaurant.id}`}
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
              <p className="font-bold text-ink" translate={restaurantDisplay.isGoogle ? 'no' : undefined}>{restaurantDisplay.name}</p>
              {(restaurant.area || restaurant.genre) && (
                <p className="text-xs text-ink-sub">{[restaurant.genre, restaurant.area].filter(Boolean).join('・')}</p>
              )}
              {(restaurantDisplay.address ?? restaurant.address) && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-sub">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="10" r="3" />
                    <path d="M12 2a8 8 0 0 1 8 8c0 5.4-8 12-8 12S4 15.4 4 10a8 8 0 0 1 8-8z" />
                  </svg>
                  <span translate={restaurantDisplay.isGoogle ? 'no' : undefined}>
                    {restaurantDisplay.address ?? restaurant.address}
                  </span>
                </p>
              )}
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="shrink-0 text-ink-sub" aria-hidden="true">
              <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}

        {/* Rating card */}
        <div className={`rounded-2xl ${ratingStyle.bg} p-4`}>
          <p className="mb-3 text-sm font-medium text-ink">このお店に、もう一度行きたいですか？</p>
          <div className="flex items-center justify-between">
            <div>
              <span className={`inline-block rounded-full px-4 py-1.5 text-base font-bold ${ratingStyle.chipBg} ${ratingStyle.text}`}>
                {RATING_LABEL[visit.rating]}
              </span>
              <p className={`mt-2 text-xs ${ratingStyle.subText}`}>{RATING_SUBLABEL[visit.rating]}</p>
            </div>
            <RatingIllustration rating={visit.rating} />
          </div>
        </div>

        {/* Comment */}
        {visit.comment && (
          <div>
            <h2 className="mb-2 text-base font-bold text-ink">ひとこと</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{visit.comment}</p>
          </div>
        )}

        {/* Tags */}
        {(visit.reason_keys.length > 0 || visit.label_keys.length > 0) && (
          <div className="space-y-3">
            {visit.reason_keys.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink-sub">
                  {visit.rating >= 3 ? '良かったポイント' : '気になったポイント'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {visit.reason_keys.map((key) => (
                    <span key={key} className="rounded-full border border-edge bg-surface px-3 py-1 text-xs text-ink">
                      {REASON_LABEL[key] ?? key}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {visit.label_keys.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink-sub">このお店の特徴</p>
                <div className="flex flex-wrap gap-2">
                  {visit.label_keys.map((key) => (
                    <span key={key} className="rounded-full border border-edge bg-surface px-3 py-1 text-xs text-ink">
                      {LABEL_LABEL[key] ?? key}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Photo */}
        {imageUrl && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">写真</h2>
              <span className="text-xs text-ink-sub">1枚</span>
            </div>
            <div className="overflow-hidden rounded-2xl bg-canvas">
              <Image
                src={imageUrl}
                alt="記録の写真"
                width={343}
                height={257}
                className="h-auto w-full object-cover"
                unoptimized
              />
            </div>
          </div>
        )}

        {/* Visit date */}
        {visit.visit_date && (
          <div className="flex items-center gap-2 text-sm text-ink-sub">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>訪問日</span>
            <span className="font-medium text-ink">{formatVisitDate(visit.visit_date)}</span>
          </div>
        )}

        {/* CTA: go to restaurant */}
        {restaurant && (
          <Link
            href={`/restaurants/${restaurant.id}`}
            className="flex h-[52px] w-full items-center justify-center gap-1.5 rounded-xl bg-terra text-base font-bold text-white"
          >
            この店舗を見る
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
