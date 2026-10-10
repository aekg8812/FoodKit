import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import BackButton from '@/components/BackButton'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'

type PreferenceCardRow = {
  label: string
  description: string | null
  image_path: string | null
  sort_order: number
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export default async function UserPreferencesPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const supabase = await createClient()

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser()
  if (!viewer) redirect('/login')

  const state = await getUserState(supabase, viewer)
  if (state === 'no_onboarding') redirect('/onboarding')

  const { data: profileData, error: profileError } = await supabase
    .from('user_public_profiles')
    .select('id, username, name, avatar_path, updated_at')
    .ilike('username', escapeLikePattern(username))
    .limit(1)
    .maybeSingle()

  if (profileError)
    throw new Error(`UserPreferencesPage: profile query failed: ${profileError.message}`)
  if (!profileData) notFound()

  const profile = profileData as {
    id: string
    username: string
    name: string | null
    avatar_path: string | null
    updated_at: string | null
  }

  const { data: cardsData, error: cardsError } = await supabase.rpc(
    'get_user_preference_cards_public',
    { p_user_id: profile.id },
  )

  if (cardsError)
    throw new Error(`UserPreferencesPage: preference cards query failed: ${cardsError.message}`)

  const cards = (cardsData ?? []) as PreferenceCardRow[]
  const displayName = profile.name ?? profile.username
  const isSelf = viewer.id === profile.id
  const initial = (displayName ?? '?').trim().charAt(0) || '?'

  const avatarRaw = profile.avatar_path
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null
  const avatarUrl =
    avatarRaw && profile.updated_at
      ? `${avatarRaw}?v=${encodeURIComponent(profile.updated_at)}`
      : avatarRaw

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Page header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Suspense>
          <BackButton fallbackHref={`/users/${profile.username}`} label="" />
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
              alt={displayName ?? ''}
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
            {profile.username && (
              <p className="text-xs text-ink-sub">@{profile.username}</p>
            )}
          </div>
        </div>

        <p className="text-sm text-ink-sub">
          {isSelf ? 'あなたがお店選びで大切にしていること' : `${displayName}さんがお店選びで大切にしていること`}
        </p>

        {cards.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface px-6 py-10 text-center">
            <p className="text-sm text-ink-sub">
              {isSelf ? 'まだ好みが設定されていません。' : 'まだ好みが設定されていません。'}
            </p>
            {isSelf && (
              <Link
                href="/mypage/food-preferences/edit"
                className="mt-4 inline-flex min-h-[40px] items-center rounded-xl bg-terra px-5 text-sm font-semibold text-white transition-colors hover:bg-terra-deep"
              >
                好みを設定する
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {cards.map((card) => {
              const imgSrc = card.image_path
                ? `${supabaseUrl}/storage/v1/object/public/preference-card-images/${card.image_path}`
                : null
              return (
                <div
                  key={card.sort_order}
                  className="relative overflow-hidden rounded-2xl bg-surface"
                  style={{ minHeight: '160px' }}
                >
                  {/* Background food photo */}
                  {imgSrc ? (
                    <Image
                      src={imgSrc}
                      alt=""
                      fill
                      sizes="50vw"
                      className="object-cover opacity-80"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[#F3E5D8]" />
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-sm font-bold leading-tight text-white">{card.label}</p>
                    {card.description && (
                      <p className="mt-0.5 text-[11px] leading-snug text-white/80 line-clamp-2">
                        {card.description}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Edit CTA for own page */}
        {isSelf && cards.length > 0 && (
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
        )}
      </div>

      <BottomNav />
    </main>
  )
}
