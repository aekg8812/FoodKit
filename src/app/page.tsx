import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LandingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/home')

  return (
    <main className="flex min-h-screen flex-col bg-canvas">
      {/* Hero area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Background gradient decoration */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(160deg, #FFF3E6 0%, #FFE4CC 40%, #FDD9B5 100%)',
          }}
        />

        {/* Decorative circles */}
        <div
          className="absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-8 -left-8 h-48 w-48 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #F97316 0%, transparent 70%)' }}
        />

        <div className="relative flex flex-col items-center px-8 pt-20 pb-10 text-center">
          {/* Logo mark */}
          <div
            className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)' }}
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <path d="M8 14c0-1.1.9-2 2-2h20a2 2 0 0 1 2 2v2a12 12 0 0 1-24 0v-2Z" fill="white" fillOpacity=".9"/>
              <path d="M15 12V9a5 5 0 0 1 10 0v3" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M20 28v5M16 33h8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>

          <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-ink">FoodKit</h1>
          <p className="text-base font-medium text-ink-sub">
            お気に入りのお店を記録して、<br />
            好みが合う人のおすすめを見つけよう。
          </p>
        </div>
      </div>

      {/* CTA area */}
      <div className="bg-surface px-6 pb-12 pt-8 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="mx-auto w-full max-w-sm space-y-3">
          <Link
            href="/signup"
            className="flex min-h-[52px] w-full items-center justify-center rounded-full text-base font-semibold text-white transition-all duration-150 active:scale-[0.98]"
            style={{ background: 'linear-gradient(90deg, #F97316 0%, #EA580C 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.4)' }}
          >
            FoodKitをはじめる
          </Link>
          <Link
            href="/login"
            className="flex min-h-[52px] w-full items-center justify-center rounded-full border border-edge bg-canvas text-base font-semibold text-ink transition-colors hover:bg-surface"
          >
            ログイン
          </Link>
        </div>
      </div>
    </main>
  )
}
