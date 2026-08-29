import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RestaurantSearchClient from './RestaurantSearchClient'

export default async function RestaurantSearchPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <RestaurantSearchClient />
}
