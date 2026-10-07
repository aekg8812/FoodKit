import { notFound, redirect } from 'next/navigation'
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
    .select('id, username, name')
    .ilike('username', escapeLikePattern(username))
    .limit(1)
    .maybeSingle()

  if (profileError)
    throw new Error(`UserPreferencesPage: profile query failed: ${profileError.message}`)
  if (!profileData) notFound()

  const profile = profileData as { id: string; username: string; name: string }

  const { data: cardsData, error: cardsError } = await supabase.rpc(
    'get_user_preference_cards_public',
    { p_user_id: profile.id },
  )

  if (cardsError)
    throw new Error(`UserPreferencesPage: preference cards query failed: ${cardsError.message}`)

  const cards = (cardsData ?? []) as PreferenceCardRow[]
  const displayName = profile.name ?? profile.username
  const isSelf = viewer.id === profile.id

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 pb-20">
      <div className="mx-auto max-w-md space-y-4">
        <Suspense>
          <BackButton fallbackHref={`/users/${profile.username}`} label="← 戻る" />
        </Suspense>

        <section className="rounded-2xl border border-edge bg-surface p-5 shadow-sm">
          <h1 className="text-base font-bold text-ink">
            {isSelf ? 'あなたの食の好み' : `${displayName}の食の好み`}
          </h1>
          {isSelf && (
            <p className="mt-1 text-xs text-ink-sub">
              好みを変更するには
              <Link href="/mypage/food-preferences/edit" className="ml-1 text-terra hover:underline">
                設定ページ
              </Link>
              から変更できます。
            </p>
          )}
        </section>

        {cards.length === 0 ? (
          <div className="rounded-2xl border border-edge bg-surface p-6 text-center">
            <p className="text-sm text-ink-sub">
              {isSelf ? 'まだ好みが設定されていません。' : 'まだ好みが設定されていません。'}
            </p>
            {isSelf && (
              <Link
                href="/mypage/food-preferences/edit"
                className="mt-3 inline-block rounded-full bg-terra px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-terra-deep"
              >
                好みを設定する
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {cards.map((card) => (
              <li
                key={card.sort_order}
                className="rounded-2xl border border-edge bg-surface px-5 py-4 shadow-sm"
              >
                <p className="font-medium text-ink">{card.label}</p>
                {card.description && (
                  <p className="mt-0.5 text-sm text-ink-sub">{card.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  )
}
