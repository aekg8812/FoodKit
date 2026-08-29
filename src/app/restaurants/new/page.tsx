import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RestaurantNewForm from './RestaurantNewForm'

export default async function RestaurantNewPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string | string[] }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const requestedName = (await searchParams).name
  const initialName = typeof requestedName === 'string' ? requestedName : ''

  return <RestaurantNewForm initialName={initialName} />
}
