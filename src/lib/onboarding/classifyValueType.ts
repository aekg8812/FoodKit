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
export function classifyValueType(q1IsYes: boolean, q2IsYes: boolean): MainValueType {
  if (q1IsYes) {
    return q2IsYes ? 'taste' : 'cost'
  }
  return q2IsYes ? 'hospitality' : 'atmosphere'
}
