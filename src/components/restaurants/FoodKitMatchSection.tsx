import { type FoodKitMatchRow, getLabelName } from '@/lib/restaurants/match'

type Props = {
  matchRow: FoodKitMatchRow | null | undefined
}

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-terra text-white'
  if (score >= 50) return 'bg-amber-400 text-white'
  return 'bg-zinc-300 text-ink'
}

export default function FoodKitMatchSection({ matchRow }: Props) {
  if (!matchRow || matchRow.data_state === 'insufficient') return null

  const { match_score, data_state, positive_contributor_keys, negative_contributor_keys } = matchRow

  if (match_score === null) return null

  const isPriorOnly = data_state === 'prior_only'
  const posKeys = positive_contributor_keys ?? []
  const negKeys = negative_contributor_keys ?? []

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">FoodKit マッチ度</h2>
        {isPriorOnly && (
          <span className="text-xs text-ink-sub">参考値</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Score circle */}
        <div
          className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full ${scoreColor(match_score)}`}
          aria-label={`マッチ度 ${match_score}`}
        >
          <span className="text-lg font-black leading-none">{match_score}</span>
          <span className="text-[10px] font-medium leading-none opacity-80">/ 100</span>
        </div>

        {/* Contributor chips */}
        <div className="flex-1 space-y-1.5">
          {posKeys.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {posKeys.map(key => (
                <span
                  key={key}
                  className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                >
                  +{getLabelName(key)}
                </span>
              ))}
            </div>
          )}
          {negKeys.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {negKeys.map(key => (
                <span
                  key={key}
                  className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500"
                >
                  −{getLabelName(key)}
                </span>
              ))}
            </div>
          )}
          {posKeys.length === 0 && negKeys.length === 0 && (
            <p className="text-xs text-ink-sub">相性の判断中です</p>
          )}
        </div>
      </div>

      {isPriorOnly && (
        <p className="mt-2.5 text-xs text-ink-sub">
          記録が増えると、あなたの好みに合わせた精度に上がります
        </p>
      )}
    </div>
  )
}
