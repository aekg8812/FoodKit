'use client'

const MAX_LABELS = 3

type LabelItem = {
  key: string
  label: string
}

type Category = {
  key: string
  title: string
  items: LabelItem[]
}

const CATEGORIES: Category[] = [
  {
    key: 'occasion',
    title: '誰と行きやすい？',
    items: [
      { key: 'solo',        label: 'ひとり向き' },
      { key: 'friends',     label: '友達向き' },
      { key: 'date',        label: 'デート向き' },
      { key: 'large_group', label: '大人数向き' },
    ],
  },
  {
    key: 'atmosphere',
    title: 'どんな雰囲気？',
    items: [
      { key: 'calm',    label: '落ち着く' },
      { key: 'lively',  label: 'にぎやか' },
      { key: 'stylish', label: 'おしゃれ' },
      { key: 'casual',  label: 'カジュアル' },
    ],
  },
  {
    key: 'experience',
    title: 'どんな使い方？',
    items: [
      { key: 'quick',      label: 'サクッと利用' },
      { key: 'long_stay',  label: '長居しやすい' },
      { key: 'hearty',     label: 'がっつり' },
      { key: 'photogenic', label: '写真映え' },
    ],
  },
]

type Props = {
  selected: string[]
  onChange: (keys: string[]) => void
  disabled?: boolean
}

export default function RestaurantLabelSelector({ selected, onChange, disabled }: Props) {
  const atMax = selected.length >= MAX_LABELS

  function toggle(key: string) {
    if (disabled) return
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key))
    } else {
      if (atMax) return
      onChange([...selected, key])
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black text-ink">このお店を表す特徴は？</h2>
        <span className="text-xs text-ink-sub">
          {selected.length} / {MAX_LABELS}
        </span>
      </div>
      <p className="text-xs text-ink-sub">任意・最大{MAX_LABELS}つ</p>

      {CATEGORIES.map((cat) => (
        <div key={cat.key}>
          <p className="mb-2 text-xs font-medium text-ink-sub">{cat.title}</p>
          <div className="flex flex-wrap gap-2">
            {cat.items.map((item) => {
              const isSelected = selected.includes(item.key)
              const isDisabled = disabled || (!isSelected && atMax)
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={isDisabled && !isSelected}
                  onClick={() => toggle(item.key)}
                  className={`flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'border-terra bg-terra/10 text-terra'
                      : isDisabled
                        ? 'cursor-not-allowed border-edge bg-surface text-ink-sub opacity-40'
                        : 'border-edge bg-surface text-ink hover:border-terra/50'
                  }`}
                >
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
