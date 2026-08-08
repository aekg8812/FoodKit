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

// Branching matrix — do NOT use value_options.value_type or score totals.
// Q1 is a branching switch only and does not contribute to classification.
//
//   Q1=yes → Q2a: yes→taste  / no→cost
//   Q1=no  → Q2b: yes→hospitality / no→atmosphere
//export function classifyValueType(q1IsYes: boolean, q2IsYes: boolean): MainValueType {
  //if (q1IsYes) {
    //return q2IsYes ? 'taste' : 'cost'
  //}
  //return q2IsYes ? 'hospitality' : 'atmosphere'
//}

// <追加点>

export type PreferenceCard = {
  id: string
  label: string
  valueType: MainValueType
}

export const PREFERENCE_CARDS: PreferenceCard[] = [
  {
    id: 'taste-1',
    label: '多少高くても、とにかくおいしい店を選びたい',
    valueType: 'taste',
  },
  {
    id: 'taste-2',
    label: '素材や調理へのこだわりが気になる',
    valueType: 'taste',
  },
  {
    id: 'taste-3',
    label: 'また食べたいと思える料理が一番大事',
    valueType: 'taste',
  },

  {
    id: 'cost-1',
    label: '値段以上の満足感がある店を選びたい',
    valueType: 'cost',
  },
  {
    id: 'cost-2',
    label: '普段使いできる価格かどうかを重視する',
    valueType: 'cost',
  },
  {
    id: 'cost-3',
    label: '量と価格のバランスが気になる',
    valueType: 'cost',
  },

  {
    id: 'hospitality-1',
    label: '店員さんの感じがよい店にまた行きたい',
    valueType: 'hospitality',
  },
  {
    id: 'hospitality-2',
    label: '丁寧な接客だと食事の満足度が上がる',
    valueType: 'hospitality',
  },
  {
    id: 'hospitality-3',
    label: '常連として覚えてもらえる店が好き',
    valueType: 'hospitality',
  },

  {
    id: 'atmosphere-1',
    label: '落ち着いて過ごせる空間を重視する',
    valueType: 'atmosphere',
  },
  {
    id: 'atmosphere-2',
    label: '友達を連れて行きたくなる雰囲気が大事',
    valueType: 'atmosphere',
  },
  {
    id: 'atmosphere-3',
    label: '内装や居心地も店選びの決め手になる',
    valueType: 'atmosphere',
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
