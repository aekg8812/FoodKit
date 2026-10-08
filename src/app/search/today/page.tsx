import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
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
    backHref = '/search'
  }

  return (
    <main className="min-h-screen bg-canvas pb-24">
      <div className="mx-auto w-full max-w-md px-5 pt-14">
        <PageHeader title="今日のお店を探す" back={{ href: backHref }} />
        <div className="mt-8">
          <TodaySearchForm initialValues={parsed} />
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
