export const RATING_LABELS: Record<number, string> = {
  4: '常連になりたい',
  3: '機会があればまた行きたい',
  2: '一度行けば十分',
  1: '二度と行かない',
}

const RATING_EMOJI: Record<number, string> = {
  4: '🤩',
  3: '😊',
  2: '😐',
  1: '😞',
}

const RATING_BADGE_CLASS: Record<number, string> = {
  4: 'bg-emerald-500 text-white',
  3: 'bg-sky-400 text-white',
  2: 'bg-amber-400 text-white',
  1: 'bg-red-400 text-white',
}

interface Props {
  rating: number
}

export default function RatingBadge({ rating }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${RATING_BADGE_CLASS[rating] ?? ''}`}
    >
      <span aria-hidden="true">{RATING_EMOJI[rating]}</span>
      {rating}
    </span>
  )
}
