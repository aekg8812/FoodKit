import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RecordsClient from './RecordsClient'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RecordsPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const raw = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tab = (() => {
    const v = Array.isArray(raw.reviewTab) ? raw.reviewTab[0] : raw.reviewTab
    if (v === 'similar' || v === 'following') return v as 'similar' | 'following'
    return 'all' as const
  })()

  const sort = (() => {
    const v = Array.isArray(raw.sort) ? raw.sort[0] : raw.sort
    if (v === 'oldest') return 'oldest' as const
    return 'newest' as const
  })()

  return (
    <Suspense>
      <RecordsClient
        restaurantId={id}
        userId={user.id}
        initialTab={tab}
        initialSort={sort}
      />
    </Suspense>
  )
}
