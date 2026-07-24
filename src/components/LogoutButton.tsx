'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-50"
    >
      ログアウト
    </button>
  )
}
