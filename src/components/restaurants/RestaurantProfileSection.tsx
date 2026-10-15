import { getTopLabels, type RestaurantProfileRow } from '@/lib/restaurants/profile'

type Props = {
  profileRows: RestaurantProfileRow[]
}

export default function RestaurantProfileSection({ profileRows }: Props) {
  // sample_size=0 means no one has entered labels yet — hide the section
  const eligible_review_count = profileRows[0]?.eligible_review_count ?? 0
  if (eligible_review_count === 0) return null

  const topLabels = getTopLabels(profileRows)
  if (topLabels.length === 0) return null

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-surface p-4">
      <h2 className="mb-3 text-sm font-bold text-ink">みんなが感じた特徴</h2>
      <div className="flex flex-wrap gap-2">
        {topLabels.map((label) => (
          <span
            key={label.label_key}
            className="rounded-full border border-edge bg-canvas px-3 py-1 text-sm text-ink"
          >
            {label.label_name}
          </span>
        ))}
      </div>
    </div>
  )
}
