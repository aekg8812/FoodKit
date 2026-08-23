import Link from 'next/link'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import Card from '@/components/ui/Card'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { createClient } from '@/lib/supabase/server'

// チーム内の進捗確認用ページ。
// 設計書の指定どおり 60秒。ただし createClient() が cookies() を読むため
// このページは動的レンダリングになり、実際には毎リクエストで集計が走る。
// 対象は件数だけの軽い関数なので許容し、指定値は将来のために残す。
export const revalidate = 60

const DAILY_RANGE = 14

type AppStats = {
  total_users: number
  total_reviews: number
  total_restaurants: number
  total_restaurants_manual: number
  active_users_7d: number
  new_users_7d: number
  new_reviews_7d: number
}

type DailyStat = {
  day: string
  new_users: number
  new_reviews: number
}

// 開発用に生エラーを出す。ユーザー向けの文言は画面側で日本語にする。
function logRpcError(label: string, error: unknown) {
  const e = error as { message?: string; code?: string; details?: string; hint?: string }
  console.error(`StatsPage: ${label} failed`, {
    message: e?.message,
    code: e?.code,
    details: e?.details,
    hint: e?.hint,
  })
}

export default async function StatsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 価値観診断の完了は問わない。数字を見るだけのページなので /onboarding には飛ばさない。
  const [summaryResult, dailyResult] = await Promise.all([
    // returns table は行の配列で返るため .single() が要る
    supabase.rpc('get_app_stats').single<AppStats>(),
    supabase.rpc('get_daily_stats', { p_days: DAILY_RANGE }),
  ])

  if (summaryResult.error) logRpcError('get_app_stats', summaryResult.error)
  if (dailyResult.error) logRpcError('get_daily_stats', dailyResult.error)

  const stats = summaryResult.data
  const daily = (dailyResult.data ?? []) as DailyStat[]

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 pb-24">
      <div className="mx-auto max-w-md">
        <Link
          href="/home"
          className="mb-5 inline-flex min-h-[44px] items-center text-sm font-medium text-ink-sub transition-colors hover:text-ink"
        >
          ← ホームに戻る
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">データ計測</h1>
          <p className="mt-1 text-sm text-ink-sub">FoodKit全体の利用状況（60秒ごとに更新）</p>
        </div>

        {stats ? (
          <>
            <section className="mb-8">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="登録者数" value={stats.total_users} unit="人" />
                <StatCard label="レビュー数" value={stats.total_reviews} unit="件" />
                <StatCard
                  label="登録店舗数"
                  value={stats.total_restaurants_manual}
                  unit="店"
                  // 全体には運営投入の店舗マスタが含まれる。ユーザーの成果は manual のみ。
                  note={`マスタ含む全体 ${stats.total_restaurants}店`}
                />
                <StatCard
                  label="アクティブ数"
                  value={stats.active_users_7d}
                  unit="人"
                  note="直近7日にレビュー投稿"
                />
                <StatCard label="新規登録" value={stats.new_users_7d} unit="人" note="直近7日" />
                <StatCard label="新規レビュー" value={stats.new_reviews_7d} unit="件" note="直近7日" />
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-base font-semibold text-ink">直近{DAILY_RANGE}日の推移</h2>
              <DailyChart daily={daily} hasError={Boolean(dailyResult.error)} />
            </section>
          </>
        ) : (
          <ErrorMessage message="集計データを取得できませんでした。時間をおいて再度お試しください。" />
        )}
      </div>

      <BottomNav />
    </main>
  )
}

function StatCard({
  label,
  value,
  unit,
  note,
}: {
  label: string
  value: number
  unit: string
  note?: string
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-ink-sub">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        {/* 0件でも「—」ではなく「0」と出す */}
        <span className="text-3xl font-bold leading-none text-ink">{value}</span>
        <span className="text-xs text-ink-sub">{unit}</span>
      </p>
      {note && <p className="mt-1.5 text-[10px] leading-tight text-ink-sub">{note}</p>}
    </Card>
  )
}

function DailyChart({ daily, hasError }: { daily: DailyStat[]; hasError: boolean }) {
  if (hasError) {
    return <ErrorMessage message="日別推移を取得できませんでした。" />
  }
  if (daily.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-ink-sub">表示できるデータがありません。</p>
      </Card>
    )
  }

  // バー幅の基準。全日0件でも0除算しないよう最低1にする。
  const max = Math.max(1, ...daily.map((d) => Math.max(d.new_users, d.new_reviews)))

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-4 text-[10px] text-ink-sub">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-terra" aria-hidden="true" />
          新規登録
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-honey" aria-hidden="true" />
          新規レビュー
        </span>
      </div>

      <ul className="space-y-2.5">
        {daily.map((d) => (
          <li key={d.day} className="flex items-center gap-2">
            {/* 375pxでも日付が折り返さないよう幅を固定する */}
            <span className="w-11 shrink-0 text-[10px] tabular-nums text-ink-sub">
              {formatDay(d.day)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Bar value={d.new_users} max={max} colorClass="bg-terra" label="新規登録" />
              <Bar value={d.new_reviews} max={max} colorClass="bg-honey" label="新規レビュー" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Bar({
  value,
  max,
  colorClass,
  label,
}: {
  value: number
  max: number
  colorClass: string
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-cream">
        <div
          className={`h-full rounded-full ${colorClass}`}
          // 0件の日はバーを描かない（幅0）。数字は右側に必ず出る。
          style={{ width: `${(value / max) * 100}%` }}
          role="img"
          aria-label={`${label} ${value}`}
        />
      </div>
      <span className="w-4 shrink-0 text-right text-[10px] tabular-nums text-ink-sub">{value}</span>
    </div>
  )
}

// get_daily_stats は date 型を 'YYYY-MM-DD' 文字列で返す。
// new Date() を挟むとタイムゾーンでズレるため文字列のまま切り出す。
function formatDay(day: string): string {
  const [, month, date] = day.split('-')
  return `${Number(month)}/${Number(date)}`
}
