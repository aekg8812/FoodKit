'use client'

type ReasonTag = {
  key: string
  label: string
}

const REASON_TAGS: ReasonTag[] = [
  { key: 'taste',      label: '味' },
  { key: 'value',      label: 'コスパ' },
  { key: 'atmosphere', label: '雰囲気' },
  { key: 'service',    label: '接客' },
  { key: 'volume',     label: 'ボリューム' },
  { key: 'access',     label: 'アクセス' },
]

type Props = {
  rating: number
  selected: string[]
  onChange: (keys: string[]) => void
  disabled?: boolean
}

export default function ReasonTagSelector({ rating, selected, onChange, disabled }: Props) {
  const isPositive = rating >= 3
  const question = isPositive ? '特に良かったポイントは？' : '合わなかったポイントは？'

  function toggle(key: string) {
    if (disabled) return
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key))
    } else {
      onChange([...selected, key])
    }
  }

  return (
    <div>
      <h2 className="text-base font-black text-ink">{question}</h2>
      <p className="mt-1 text-xs text-ink-sub">任意・複数選択可</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {REASON_TAGS.map((tag) => {
          const isSelected = selected.includes(tag.key)
          return (
            <button
              key={tag.key}
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => toggle(tag.key)}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                isSelected
                  ? 'border-terra bg-terra/10 text-terra'
                  : 'border-edge bg-surface text-ink hover:border-terra/50'
              } disabled:opacity-50`}
            >
              {isSelected && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {tag.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
