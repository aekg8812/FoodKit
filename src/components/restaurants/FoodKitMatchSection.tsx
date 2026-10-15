import { type FoodKitMatchRow, getLabelName } from '@/lib/restaurants/match'

type Props = {
  matchRow: FoodKitMatchRow | null | undefined
}

function scoreCircleClass(score: number): string {
  if (score >= 70) return 'bg-terra text-white'
  if (score >= 50) return 'bg-orange-50 text-terra'
  return 'bg-zinc-100 text-zinc-500'
}

export default function FoodKitMatchSection({ matchRow }: Props) {
  const isInsufficient = !matchRow || matchRow.data_state === 'insufficient' || matchRow.match_score === null

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-surface p-4">
      <h2 className="mb-3 text-sm font-bold text-ink">あなたとの相性</h2>

      {isInsufficient ? (
        <div>
          <p className="text-sm text-ink-sub">相性を計算するためのデータを集めています</p>
          <p className="mt-1 text-xs text-ink-sub">
            記録やみんなの投稿が増えると、よりあなたに合った相性がわかります
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {/* Score circle */}
            <div
              className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full ${scoreCircleClass(matchRow.match_score!)}`}
              aria-label={`マッチ度 ${matchRow.match_score}`}
            >
              <span className="text-lg font-black leading-none">{matchRow.match_score}</span>
              <span className="text-[10px] font-medium leading-none opacity-70">/ 100</span>
            </div>

            {/* Positive contributor chips only (max 2) */}
            <div className="flex-1">
              {(matchRow.positive_contributor_keys?.slice(0, 2) ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {(matchRow.positive_contributor_keys!.slice(0, 2)).map(key => (
                    <span
                      key={key}
                      className="rounded-full border border-edge bg-canvas px-2.5 py-0.5 text-xs font-medium text-ink"
                    >
                      {getLabelName(key)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-sub">相性の判断中です</p>
              )}
            </div>
          </div>

          {matchRow.data_state === 'prior_only' && (
            <p className="mt-2.5 text-xs text-ink-sub">好み設定をもとに算出</p>
          )}
        </>
      )}
    </div>
  )
}
