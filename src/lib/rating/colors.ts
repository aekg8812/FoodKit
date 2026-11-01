// 評価カラー共通定義
// 4=赤（最高評価）, 3=オレンジ（良い）, 2=青（ニュートラル）, 1=グレー（ネガティブ）

export const RATING_LABELS: Record<number, string> = {
  4: '常連になりたい',
  3: 'また行きたい',
  2: '一度で十分',
  1: '二度と行かない',
}

// チップ・バッジ用：淡い背景
export const RATING_BG: Record<number, string> = {
  4: 'bg-red-50',
  3: 'bg-orange-50',
  2: 'bg-blue-50',
  1: 'bg-zinc-100',
}

// チップ・バッジ用：文字色
export const RATING_TEXT: Record<number, string> = {
  4: 'text-red-700',
  3: 'text-orange-500',
  2: 'text-blue-700',
  1: 'text-zinc-600',
}

// チップ用：枠線色（淡い）
export const RATING_BORDER: Record<number, string> = {
  4: 'border-red-200',
  3: 'border-orange-200',
  2: 'border-blue-200',
  1: 'border-zinc-300',
}

// 入力フォームのラジオ枠・ドット用：中程度の濃さ
export const RATING_ACCENT_BORDER: Record<number, string> = {
  4: 'border-red-400',
  3: 'border-orange-400',
  2: 'border-blue-400',
  1: 'border-zinc-400',
}

export const RATING_ACCENT_DOT: Record<number, string> = {
  4: 'bg-red-400',
  3: 'bg-orange-400',
  2: 'bg-blue-400',
  1: 'bg-zinc-400',
}

// 棒グラフ・分布バー用（やや濃い）
export const RATING_BAR: Record<number, string> = {
  4: 'bg-red-500',
  3: 'bg-orange-500',
  2: 'bg-blue-500',
  1: 'bg-zinc-500',
}

// 詳細ページ内チップ用：少し濃い背景
export const RATING_INNER_BG: Record<number, string> = {
  4: 'bg-red-100',
  3: 'bg-orange-100',
  2: 'bg-blue-100',
  1: 'bg-zinc-200',
}

// ReviewForm ボタンアクティブ状態（bg + text + border をまとめた className）
export const RATING_ACTIVE_CLASS: Record<number, string> = {
  4: 'bg-red-50 text-red-700 border-red-200',
  3: 'bg-orange-50 text-orange-500 border-orange-200',
  2: 'bg-blue-50 text-blue-700 border-blue-200',
  1: 'bg-zinc-100 text-zinc-600 border-zinc-300',
}

// SVG イラスト用 hex（Tailwind クラスが使えないインライン属性）
// red-500=#EF4444, orange-500=#F97316, blue-500=#3B82F6, zinc-500=#71717A
export const RATING_SVG_HEX: Record<number, string> = {
  4: '#EF4444',
  3: '#F97316',
  2: '#3B82F6',
  1: '#71717A',
}
