import { redirect } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import { parseTodaySearchParams, serializeTodaySearchParams } from '@/lib/restaurants/todaySearch'
import TodaySearchForm from './TodaySearchForm'

type SearchTodayPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SearchTodayPage({ searchParams }: SearchTodayPageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/search/today', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const raw = await searchParams
  const parsed = parseTodaySearchParams(raw)

  const fromRaw = (Array.isArray(raw.from) ? raw.from[0] : raw.from) ?? ''
  const isFromResults = fromRaw === 'results'

  let backHref: string
  if (isFromResults) {
    const qs = serializeTodaySearchParams(parsed).toString()
    backHref = `/search/today/results${qs ? `?${qs}` : ''}`
  } else {
    backHref = '/home'
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      {/* Header */}
      <div className="flex items-center border-b border-edge bg-canvas px-4 pt-14 pb-3">
        <Link href={backHref} className="flex h-10 w-10 items-center justify-center text-ink" aria-label="戻る">
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
            <path d="M9 1 L1 9 L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-ink">今日のお店</h1>
        <div className="w-10" />
      </div>

      <TodaySearchForm initialValues={parsed} />

      <BottomNav />
    </main>
  )
}
