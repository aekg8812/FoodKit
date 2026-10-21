import {
  getTopExperienceLabels,
  getTopDecisionFactors,
  type UserProfileRow,
} from '@/lib/users/profile'

type Props = {
  profileRows: UserProfileRow[]
}

export default function UserProfileSection({ profileRows }: Props) {
  const topLabels = getTopExperienceLabels(profileRows)
  const topFactors = getTopDecisionFactors(profileRows)

  if (topLabels.length === 0 && topFactors.length === 0) return null

  // If every displayed chip comes from Preference Card prior alone (no behavior evidence),
  // show a soft learning hint so the user knows their records will refine these results.
  const displayedRows = [...topLabels, ...topFactors]
  const allFromPrior = displayedRows.length > 0 && displayedRows.every(r => r.source === 'prior')

  return (
    <section>
      <h2 className="mb-3 font-bold text-ink">FoodKitが学習したあなたの好み</h2>
      <div className="rounded-2xl bg-surface p-4 space-y-4">
        {topLabels.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold text-ink-sub">あなたが好きそうな特徴</p>
            <div className="flex flex-wrap gap-2">
              {topLabels.map(label => (
                <span
                  key={label.signal_key}
                  className="rounded-full border border-edge bg-canvas px-3 py-1 text-sm text-ink"
                >
                  {label.signal_name}
                </span>
              ))}
            </div>
          </div>
        )}

        {topFactors.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold text-ink-sub">あなたが重視するポイント</p>
            <div className="flex flex-wrap gap-2">
              {topFactors.map(factor => (
                <span
                  key={factor.signal_key}
                  className="rounded-full border border-edge bg-canvas px-3 py-1 text-sm text-ink"
                >
                  {factor.signal_name}
                </span>
              ))}
            </div>
          </div>
        )}

        {allFromPrior && (
          <p className="text-xs text-ink-sub">
            記録が増えると、あなたの好みをより詳しく学習します
          </p>
        )}
      </div>
    </section>
  )
}
