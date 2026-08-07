import { RATING_COLORS, RATINGS, type Distribution } from '@/lib/restaurants/aggregate'

interface Props {
  dist: Distribution
  countLabel: string
  emptyMessage: string
}

export default function DistributionDisplay({ dist, countLabel, emptyMessage }: Props) {
  if (dist.total === 0) {
    return <p className="mt-2 text-xs text-ink-sub">{emptyMessage}</p>
  }

  return (
    <div className="mt-3">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-canvas">
        {RATINGS.map((r) =>
          dist.counts[r] > 0 ? (
            <div
              key={r}
              style={{ width: `${dist.percents[r]}%` }}
              className={RATING_COLORS[r]}
            />
          ) : null,
        )}
      </div>
      <div className="mt-1 flex gap-3 text-xs">
        {RATINGS.map((r) => (
          <span key={r} className={dist.counts[r] === 0 ? 'text-edge' : 'text-ink-sub'}>
            {r}: {dist.percents[r]}%
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-xs text-ink-sub">
        {countLabel}&nbsp;{dist.total}人の評価
      </p>
    </div>
  )
}
