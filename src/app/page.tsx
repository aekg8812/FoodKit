import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

// 実績を出し始めるしきい値。
// 100ユーザー目標に対して「すでに3人が使っています」は逆効果になるため、
// ここに達するまでは数字を出さない。指標ごとに独立して判定する。
const MIN_USERS_TO_SHOW = 10
const MIN_RESTAURANTS_TO_SHOW = 10

type StatLine = {
  prefix: string
  value: number
  suffix: string
}

type PublicLandingStats = {
  total_users: number
  total_restaurants_manual: number
}

// 起動画面はアプリの入口なので、集計に失敗しても画面は必ず描画する。
// 数字を出さないだけにとどめ、開発用に生エラーだけ残す。
async function loadLandingStatLines(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<StatLine[]> {
  const { data, error } = await supabase
    .rpc('get_public_landing_stats')
    .single<PublicLandingStats>()

  if (error) {
    console.error('LandingPage: get_public_landing_stats failed', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })
    return []
  }
  if (!data) return []

  const lines: StatLine[] = []
  if (data.total_users >= MIN_USERS_TO_SHOW) {
    lines.push({ prefix: 'すでに', value: data.total_users, suffix: '人が使っています' })
  }
  if (data.total_restaurants_manual >= MIN_RESTAURANTS_TO_SHOW) {
    lines.push({ prefix: '', value: data.total_restaurants_manual, suffix: '件のお店が記録されています' })
  }
  return lines
}

export default async function LandingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/home')

  const statLines = await loadLandingStatLines(supabase)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-16">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cream text-4xl">
            🍽️
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-ink">FoodKit</h1>
          <p className="text-sm leading-relaxed text-ink-sub">
            お店を記録して、友だちと共有。
          </p>
          <p className="text-sm leading-relaxed text-ink-sub">
            価値観の合う人の「また行きたい」が見つかる。
          </p>
        </div>

        {/* Features */}
        <ul className="mb-10 space-y-3 text-sm text-ink-sub">
          <li className="flex items-start gap-2">
            <span aria-hidden="true">📝</span>
            <span>「また行きたいか」で1〜4段階評価</span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden="true">👥</span>
            <span>グループの友だちと記録を共有</span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden="true">✨</span>
            <span>価値観が合う人のおすすめが分かる</span>
          </li>
        </ul>

        {/* 実績: しきい値に届いた指標だけを出す。0件のときはブロックごと消える */}
        {statLines.length > 0 && (
          <div className="mb-10 rounded-2xl border border-edge bg-surface px-5 py-4">
            <ul className="space-y-1.5 text-center text-sm text-ink-sub">
              {statLines.map((line) => (
                <li key={line.suffix}>
                  {line.prefix}
                  <span className="text-base font-bold text-terra">{line.value}</span>
                  {line.suffix}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="space-y-3">
          <Link
            href="/signup"
            className="flex min-h-[44px] w-full items-center justify-center rounded-full bg-terra text-sm font-medium text-white transition-colors hover:bg-terra-deep"
          >
            新規登録する
          </Link>
          <Link
            href="/login"
            className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-edge text-sm font-medium text-ink transition-colors hover:bg-surface"
          >
            ログイン
          </Link>
        </div>
      </div>
    </main>
  )
}
