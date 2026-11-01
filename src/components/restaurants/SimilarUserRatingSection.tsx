import Link from 'next/link'

type Props = {
  viewerCardCount: number
  similarReviewerCount: number | null
  highRatingReviewerCount: number | null
  allReviewerCount: number | null
  allHighRatingReviewerCount: number | null
}

export default function SimilarUserRatingSection({
  viewerCardCount,
  similarReviewerCount,
  highRatingReviewerCount,
  allReviewerCount,
  allHighRatingReviewerCount,
}: Props) {
  // RPC error: both sides are null → show error, never show 0%
  if (similarReviewerCount === null) {
    return (
      <div className="mx-4 mt-4 rounded-2xl bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">好みが近い人の評価</h2>
        <p className="text-sm text-ink-sub">データを取得できませんでした</p>
      </div>
    )
  }

  const simPercent =
    similarReviewerCount > 0
      ? Math.round((highRatingReviewerCount! / similarReviewerCount) * 100)
      : null

  const allPercent =
    allReviewerCount !== null && allReviewerCount > 0
      ? Math.round((allHighRatingReviewerCount! / allReviewerCount) * 100)
      : null

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-surface p-4">
      <h2 className="mb-3 text-sm font-bold text-ink">好みが近い人の評価</h2>

      {/* Two-column comparison — always shown when no RPC error */}
      <div className="flex items-start">
        {/* Left column — state-dependent */}
        <div className="min-w-0 flex-1">
          {viewerCardCount < 5 ? (
            /* Viewer has not set preferences */
            <>
              <p className="text-sm text-ink-sub">好みを設定すると表示できます</p>
              <Link
                href="/mypage/food-preferences/edit"
                className="mt-2 inline-block text-xs font-medium text-terra underline underline-offset-2"
              >
                好みを設定する
              </Link>
            </>
          ) : simPercent === null ? (
            /* Viewer has preferences but no similar user has reviewed */
            <>
              <p className="text-sm text-ink-sub">データ収集中</p>
              <p className="mt-1 text-xs text-ink-sub">
                好みが近い人がこのお店を記録すると表示されます
              </p>
            </>
          ) : (
            /* Similar reviewers exist */
            <>
              <p className="text-3xl font-black leading-none text-ink" aria-hidden="true">
                {simPercent}%
              </p>
              <p className="mt-1 text-sm text-ink-sub">
                {similarReviewerCount}人中{highRatingReviewerCount}人が高評価
              </p>
            </>
          )}
        </div>

        {/* Vertical divider */}
        <div className="mx-3 w-px self-stretch bg-edge" aria-hidden="true" />

        {/* Right column: all-user aggregate */}
        <div className="w-24 shrink-0">
          <p className="text-xs text-ink-sub">みんなでは</p>
          {allPercent === null ? (
            <p className="mt-0.5 text-xl font-bold text-ink-sub">—</p>
          ) : (
            <>
              <p className="mt-0.5 text-xl font-bold text-ink-sub" aria-hidden="true">
                {allPercent}%
              </p>
              <p className="text-xs text-ink-sub">
                {allReviewerCount}人中{allHighRatingReviewerCount}人
              </p>
            </>
          )}
        </div>
      </div>

      {/* Progress bar — only when similar data exists */}
      {simPercent !== null && (
        <>
          <div
            role="progressbar"
            aria-label={`好みが近い人の高評価率 ${simPercent}%`}
            aria-valuenow={simPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-edge"
          >
            <div
              className="h-full rounded-full bg-terra transition-all duration-300"
              style={{ width: `${simPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-sub">
            あなたと好みが近く、このお店を記録した人のうち、評価3・4を付けた人の割合
          </p>
        </>
      )}

      {/* Caution for 1–2 similar reviewers */}
      {simPercent !== null && similarReviewerCount <= 2 && (
        <div className="mt-2.5 flex items-start gap-1.5">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 shrink-0 text-amber-500"
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-xs text-amber-600">評価した人数が少ないため参考情報です</p>
        </div>
      )}
    </div>
  )
}
