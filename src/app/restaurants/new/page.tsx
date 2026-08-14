import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RestaurantNewForm from './RestaurantNewForm'

export default async function RestaurantNewPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <RestaurantNewForm />
}
