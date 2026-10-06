import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageHeader from '@/components/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { getUserState } from '@/lib/auth/getUserState'
import { logPageAuthRequest } from '@/lib/diagnostics/authRequests'
import {
  parseTodaySearchParams,
  serializeTodaySearchParams,
} from '@/lib/restaurants/todaySearch'
import TodayResultsClient from './TodayResultsClient'

type SearchTodayResultsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SearchTodayResultsPage({ searchParams }: SearchTodayResultsPageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await logPageAuthRequest('/search/today/results', Boolean(user))
  if (!user) redirect('/login')

  const state = await getUserState(supabase, user)
  if (state === 'no_onboarding') redirect('/onboarding')

  const raw = await searchParams
  const parsed = parseTodaySearchParams(raw)

  const conditionQs = serializeTodaySearchParams(parsed).toString()
  const changeHref = `/search/today${conditionQs ? `?${conditionQs}&from=results` : '?from=results'}`

  return (
    <main className="min-h-screen bg-canvas px-6 pt-6 pb-24">
      <div className="mx-auto w-full max-w-md">
        <PageHeader title="おすすめのお店" back={{ href: changeHref }} />
        <TodayResultsClient params={parsed} changeHref={changeHref} />
      </div>
      <BottomNav />
    </main>
  )
}
