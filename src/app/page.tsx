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
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden bg-canvas">
      {/* Hidden SVG clip-path definition for hero blob */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <clipPath id="hero-blob" clipPathUnits="objectBoundingBox">
            <path d="M0.02,0.05 C0.18,-0.03 0.5,0.02 0.82,0 C0.93,-0.01 1,0.05 1,0.09 L1,0.78 C0.88,0.90 0.74,0.86 0.62,0.93 C0.50,0.99 0.38,0.97 0.27,0.91 C0.16,0.86 0.06,0.90 0,0.84 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Background blob decorations */}
      {/* Top-left peach blob */}
      <div
        className="pointer-events-none absolute -left-10 -top-6 h-[120px] w-[120px] rounded-[60%_40%_55%_45%/50%_60%_40%_50%] opacity-60"
        style={{ background: '#FFD9B4' }}
        aria-hidden="true"
      />
      {/* Top-right peach blob */}
      <div
        className="pointer-events-none absolute -right-8 top-4 h-[90px] w-[90px] rounded-[45%_55%_60%_40%/55%_45%_55%_45%] opacity-50"
        style={{ background: '#FECDA0' }}
        aria-hidden="true"
      />
      {/* Bottom-right orange blob */}
      <div
        className="pointer-events-none absolute -right-6 bottom-[140px] h-[140px] w-[140px] rounded-[50%_40%_60%_50%/60%_50%_45%_55%] opacity-70"
        style={{ background: '#FDBA74' }}
        aria-hidden="true"
      />
      {/* Bottom-left peach blob */}
      <div
        className="pointer-events-none absolute -left-8 bottom-[160px] h-[80px] w-[80px] rounded-[55%_45%_40%_60%/45%_55%_50%_50%] opacity-40"
        style={{ background: '#FFD9B4' }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-[390px]">
        {/* Logo + tagline */}
        <div className="pt-14 pb-3 text-center">
          {/* FoodKit logo — "Food" dark, fork-o badge, "Kit" orange, sparkle */}
          <div className="relative inline-flex items-center justify-center">
            <span
              className="select-none text-[48px] font-black leading-none tracking-tight text-ink"
              style={{ fontFamily: "'Nunito', 'Hiragino Sans', system-ui, sans-serif" }}
            >
              F
            </span>
            {/* fork-in-circle badge replacing the 'o' in Food */}
            <span className="relative mx-0.5 inline-flex h-[40px] w-[40px] items-center justify-center">
              <svg viewBox="0 0 42 42" fill="none" className="h-full w-full" aria-hidden="true">
                <circle cx="21" cy="21" r="21" fill="#F97316" />
                {/* Fork handle */}
                <line x1="21" y1="10" x2="21" y2="36" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
                {/* Fork tines */}
                <path
                  d="M15 10 L15 20 Q15 25 21 25 Q27 25 27 20 L27 10"
                  stroke="white"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </span>
            <span
              className="select-none text-[48px] font-black leading-none tracking-tight text-ink"
              style={{ fontFamily: "'Nunito', 'Hiragino Sans', system-ui, sans-serif" }}
            >
              od
            </span>
            <span
              className="select-none text-[48px] font-black leading-none tracking-tight text-terra"
              style={{ fontFamily: "'Nunito', 'Hiragino Sans', system-ui, sans-serif" }}
            >
              Kit
            </span>
            {/* Sparkle decoration */}
            <span className="absolute -right-4 -top-3" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 0 L9.2 5.8 L15 8 L9.2 10.2 L8 16 L6.8 10.2 L1 8 L6.8 5.8 Z"
                  fill="#F97316"
                />
              </svg>
            </span>
          </div>

          {/* Tagline */}
          <p className="mt-2 text-sm leading-snug text-ink-sub">
            みんなの「また行きたい」から見つかる、
            <br />
            次のお店。
          </p>
        </div>

        {/* Hero food image with organic blob mask + accent dashes */}
        <div className="relative w-full" style={{ height: '260px' }}>
          {/* Orange accent dashes */}
          <span
            className="pointer-events-none absolute right-[28px] top-[8px] h-[3px] w-[18px] rounded-full bg-terra"
            style={{ transform: 'rotate(-35deg)' }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute right-[10px] top-[40px] h-[3px] w-[14px] rounded-full bg-terra"
            style={{ transform: 'rotate(15deg)' }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute left-[10px] bottom-[50px] h-[3px] w-[16px] rounded-full bg-terra opacity-70"
            style={{ transform: 'rotate(25deg)' }}
            aria-hidden="true"
          />

          {/* Blob-masked image */}
          <div
            className="h-full w-full overflow-hidden"
            style={{ clipPath: 'url(#hero-blob)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero-food.png"
              alt=""
              className="h-full w-full object-cover"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Headline */}
        <div className="px-6 pt-5">
          <h1
            className="text-[32px] font-black leading-[1.25] text-ink"
            style={{ fontFamily: "'Nunito', 'Hiragino Sans', system-ui, sans-serif" }}
          >
            次のお店を、
            <br />
            みんなの
            <span className="text-terra">「また行きたい」</span>
            から。
          </h1>
        </div>

        {/* Description */}
        <div className="px-6 pt-3">
          <p className="text-center text-sm leading-relaxed text-ink-sub">
            自分や友達の飲食店記録を共有して、
            <br />
            好みの合う人の記録から次のお店を見つけよう。
          </p>
        </div>

        {/* CTA buttons */}
        <div className="px-6 pb-10 pt-6 space-y-3">
          <Link
            href="/signup"
            className="flex h-[52px] w-full items-center justify-center rounded-xl bg-terra text-base font-bold text-white"
          >
            FoodKitをはじめる　›
          </Link>
          <p className="text-center text-sm text-ink-sub">
            アカウントをお持ちの方は{' '}
            <Link href="/login" className="font-bold text-terra">
              ログイン ›
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
