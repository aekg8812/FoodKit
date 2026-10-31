import { RATING_LABELS, RATING_BG, RATING_TEXT } from '@/lib/rating/colors'

export { RATING_LABELS }

const RATING_EMOJI: Record<number, string> = {
  4: '🤩',
  3: '😊',
  2: '😐',
  1: '😞',
}

interface Props {
  rating: number
}

export default function RatingBadge({ rating }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${RATING_BG[rating] ?? ''} ${RATING_TEXT[rating] ?? ''}`}
    >
      <span aria-hidden="true">{RATING_EMOJI[rating]}</span>
      {rating}
    </span>
  )
}
