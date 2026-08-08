export type MainValueType = 'taste' | 'cost' | 'hospitality' | 'atmosphere'

export const VALUE_TYPE_LABEL: Record<MainValueType, string> = {
  taste: '味重視',
  cost: 'コスパ重視',
  hospitality: '接客重視',
  atmosphere: '雰囲気重視',
}

export const VALUE_TYPE_DESCRIPTION: Record<MainValueType, string> = {
  taste: '料理の質とおいしさを何より大切にしています',
  cost: '価格に見合った満足感を大事にしています',
  hospitality: '店員さんの人柄や接客が体験を決めると感じています',
  atmosphere: 'お店の空間やムードを大切にしています',
}

export type PreferenceCategory = 'choose' | 'enjoy' | 'together' | 'revisit'

export const PREFERENCE_CATEGORY_LABEL: Record<PreferenceCategory, string> = {
  choose: '店を選ぶ',
  enjoy: '食事を楽しむ',
  together: '一緒に過ごす',
  revisit: 'また行きたい',
}

export type PreferenceCard = {
  id: string
  label: string
  tag: string
  category: PreferenceCategory
  valueType: MainValueType
  // 画像対応: public配下に置くカード専用画像のパス
  imagePath: string
}

export const PREFERENCE_CARDS: PreferenceCard[] = [
  {
    id: 'choose-taste',
    label: 'おいしいと評判の料理がある店を選びたい',
    tag: '評判の味',
    category: 'choose',
    valueType: 'taste',
    imagePath: '/preference-cards/choose-taste.webp',
  },
  {
    id: 'choose-cost',
    label: '予算内で満足できる店を選びたい',
    tag: '予算内',
    category: 'choose',
    valueType: 'cost',
    imagePath: '/preference-cards/choose-cost.webp',
  },
  {
    id: 'choose-hospitality',
    label: '店員さんの感じがよさそうな店を選びたい',
    tag: '第一印象',
    category: 'choose',
    valueType: 'hospitality',
    imagePath: '/preference-cards/choose-hospitality.webp',
  },
  {
    id: 'choose-atmosphere',
    label: '落ち着いて過ごせそうな店を選びたい',
    tag: '落ち着き',
    category: 'choose',
    valueType: 'atmosphere',
    imagePath: '/preference-cards/choose-atmosphere.webp',
  },
  {
    id: 'enjoy-taste',
    label: '素材や調理へのこだわりを楽しみたい',
    tag: 'こだわり',
    category: 'enjoy',
    valueType: 'taste',
    imagePath: '/preference-cards/enjoy-taste.webp',
  },
  {
    id: 'enjoy-cost',
    label: '量と価格のバランスがよいとうれしい',
    tag: 'バランス',
    category: 'enjoy',
    valueType: 'cost',
    imagePath: '/preference-cards/enjoy-cost.webp',
  },
  {
    id: 'enjoy-hospitality',
    label: '料理を出すタイミングや気配りも大切にしたい',
    tag: 'タイミング',
    category: 'enjoy',
    valueType: 'hospitality',
    imagePath: '/preference-cards/enjoy-hospitality.webp',
  },
  {
    id: 'enjoy-atmosphere',
    label: '店内の雰囲気も含めて食事を楽しみたい',
    tag: '店内体験',
    category: 'enjoy',
    valueType: 'atmosphere',
    imagePath: '/preference-cards/enjoy-atmosphere.webp',
  },
  {
    id: 'together-taste',
    label: 'おいしい料理を誰かに紹介したい',
    tag: 'おすすめ',
    category: 'together',
    valueType: 'taste',
    imagePath: '/preference-cards/together-taste.webp',
  },
  {
    id: 'together-cost',
    label: 'みんなが払いやすい価格を重視したい',
    tag: 'みんなの予算',
    category: 'together',
    valueType: 'cost',
    imagePath: '/preference-cards/together-cost.webp',
  },
  {
    id: 'together-hospitality',
    label: '一緒にいる人にも丁寧に対応してほしい',
    tag: 'おもてなし',
    category: 'together',
    valueType: 'hospitality',
    imagePath: '/preference-cards/together-hospitality.webp',
  },
  {
    id: 'together-atmosphere',
    label: 'ゆっくり会話できる空間を選びたい',
    tag: '会話',
    category: 'together',
    valueType: 'atmosphere',
    imagePath: '/preference-cards/together-atmosphere.webp',
  },
  {
    id: 'revisit-taste',
    label: 'また食べたいと思える料理がある',
    tag: 'リピートの味',
    category: 'revisit',
    valueType: 'taste',
    imagePath: '/preference-cards/revisit-taste.webp',
  },
  {
    id: 'revisit-cost',
    label: '値段以上の満足感がある',
    tag: '満足感',
    category: 'revisit',
    valueType: 'cost',
    imagePath: '/preference-cards/revisit-cost.webp',
  },
  {
    id: 'revisit-hospitality',
    label: '店員さんとのやり取りが心地よい',
    tag: '心地よい接客',
    category: 'revisit',
    valueType: 'hospitality',
    imagePath: '/preference-cards/revisit-hospitality.webp',
  },
  {
    id: 'revisit-atmosphere',
    label: '自分の居場所にしたくなる雰囲気がある',
    tag: '自分の居場所',
    category: 'revisit',
    valueType: 'atmosphere',
    imagePath: '/preference-cards/revisit-atmosphere.webp',
  },
]

export type ValueScores = Record<MainValueType, number>

const EMPTY_SCORES: ValueScores = {
  taste: 0,
  cost: 0,
  hospitality: 0,
  atmosphere: 0,
}

export function calculateValueScores(
  selectedCardIds: string[],
): ValueScores {
  const scores = { ...EMPTY_SCORES }

  for (const cardId of selectedCardIds) {
    const card = PREFERENCE_CARDS.find(
      (candidate) => candidate.id === cardId,
    )

    if (card) {
      scores[card.valueType] += 1
    }
  }

  return scores
}

export function getTopValueTypes(
  scores: ValueScores,
): MainValueType[] {
  const highestScore = Math.max(...Object.values(scores))

  return (Object.keys(scores) as MainValueType[]).filter(
    (type) => scores[type] === highestScore,
  )
}

export function calculateConfidence(scores: ValueScores): number {
  const highestScore = Math.max(...Object.values(scores))
  return highestScore / 5
}
