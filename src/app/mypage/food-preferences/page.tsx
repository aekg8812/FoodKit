import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'

export default async function FoodPreferencesSummaryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  type CardJoin = { key: string; label: string; description: string | null; image_path: string | null; sort_order: number }

  const [selectionResult, profileResult] = await Promise.all([
    supabase
      .from('user_preference_cards')
      .select('preference_card_id, preference_cards(key, label, description, image_path, sort_order)')
      .eq('user_id', user.id),
    supabase
      .from('user_public_profiles')
      .select('id, username, name, avatar_path, updated_at')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const selectedCards: CardJoin[] = (selectionResult.data ?? [])
    .map((row) => {
      const pc = row.preference_cards
      if (!pc) return null
      return Array.isArray(pc) ? (pc[0] as CardJoin) : (pc as CardJoin)
    })
    .filter((c): c is CardJoin => c !== null)
    .sort((a, b) => a.sort_order - b.sort_order)

  const profile = profileResult.data as {
    id: string; username: string | null; name: string | null; avatar_path: string | null; updated_at: string | null
  } | null

  const displayName = profile?.name ?? profile?.username ?? ''
  const initial = Array.from(displayName.trim())[0] ?? '?'
  const avatarRaw = profile?.avatar_path
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null
  const avatarUrl = avatarRaw && profile?.updated_at
    ? `${avatarRaw}?v=${encodeURIComponent(profile.updated_at)}`
    : avatarRaw

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return (
    <div className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref="/mypage" label="" />
        </Suspense>
        <h1 className="flex-1 text-center text-base font-bold text-ink">食の価値観</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Profile row */}
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={44}
              height={44}
              className="h-11 w-11 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-edge text-base font-bold text-ink-sub">
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-bold text-ink">{displayName}</p>
            {profile?.username && (
              <p className="text-xs text-ink-sub">@{profile.username}</p>
            )}
          </div>
        </div>

        <p className="text-sm text-ink-sub">あなたがお店選びで大切にしていること</p>

        {selectedCards.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-6 py-10 text-center">
            <p className="text-sm text-ink-sub">まだ好みが設定されていません。</p>
            <Link
              href="/mypage/food-preferences/edit"
              className="mt-4 inline-flex min-h-[40px] items-center rounded-xl bg-terra px-5 text-sm font-semibold text-white transition-colors hover:bg-terra-deep"
            >
              好みを設定する
            </Link>
          </div>
        ) : (
          <>
            {/* 2-column card grid — image-top + text-below */}
            <div className="grid grid-cols-2 gap-3">
              {selectedCards.map((card) => {
                const imgSrc = card.image_path
                  ? `${supabaseUrl}/storage/v1/object/public/preference-card-images/${card.image_path}`
                  : null
                return (
                  <div key={card.key} className="overflow-hidden rounded-2xl border border-edge bg-surface">
                    <div className="relative h-28 w-full overflow-hidden bg-edge">
                      {imgSrc && (
                        <Image src={imgSrc} alt="" fill sizes="50vw" className="object-cover" unoptimized />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-sm font-bold leading-snug text-ink">{card.label}</p>
                      {card.description && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-sub">{card.description}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <Link
              href="/mypage/food-preferences/edit"
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-terra text-sm font-bold text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              好みを編集する
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                <path d="M1 1l6 6-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
