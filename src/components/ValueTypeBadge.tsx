import { VALUE_TYPE_LABEL, type MainValueType } from '@/lib/onboarding/classifyValueType'

// terra / rose / honey / sage の4系統
// rating の4色（emerald/sky/amber/red）とは明確に別系統
const BADGE_CLASS: Record<string, string> = {
  taste:       'bg-canvas text-terra',          // terra系：温かみ・深み
  cost:        'bg-rose-100 text-rose-700',      // rose系：実用・経済的
  hospitality: 'bg-cream text-amber-800',        // honey系：温かいサービス
  atmosphere:  'bg-green-50 text-green-700',    // sage系：自然・落ち着き
}

interface Props {
  type: string | null | undefined
}

export default function ValueTypeBadge({ type }: Props) {
  if (!type) {
    return <span className="text-sm text-ink-sub">未設定</span>
  }
  const label = VALUE_TYPE_LABEL[type as MainValueType] ?? type
  const cls = BADGE_CLASS[type] ?? 'bg-canvas text-ink-sub'
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-sm font-medium ${cls}`}>
      {label}
    </span>
  )
}
