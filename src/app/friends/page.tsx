import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import FriendsTabs from './FriendsTabs'

export default function FriendsPage() {
  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-20">
      <div className="mx-auto w-full max-w-md">
        <h1 className="mb-6 text-2xl font-bold text-ink">友人・グループ</h1>
        <Suspense fallback={null}>
          <FriendsTabs />
        </Suspense>
      </div>
      <BottomNav />
    </main>
  )
}
