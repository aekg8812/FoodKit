export type UserProfileRow = {
  profile_type: 'experience' | 'decision_factor'
  signal_key: string
  signal_name: string
  category: string | null  // 'occasion'|'atmosphere'|'experience' for experience; null for decision_factor
  sort_order: number
  preference_score: number | null  // Experience: blended [-1,1] or NULL (unknown); Decision: NULL
  importance_score: number | null  // Decision: blended [0,1] or NULL (unknown); Experience: NULL
  direction_score: number | null   // Decision: behavior direction [-1,1] or NULL (no evidence); Experience: NULL
  evidence_count: number           // Experience: label count; Decision: factor_count
  sample_size: number              // Experience: same as evidence_count; Decision: reason_sample_size
  confidence: number               // Experience: n/(n+3); Decision: importance_confidence m/(m+3)
  direction_confidence: number | null  // Decision: factor_count/(factor_count+3); Experience: NULL
  positive_evidence: number
  negative_evidence: number
  source: 'unknown' | 'prior' | 'behavior' | 'blended'
}

export function getExperienceRows(rows: UserProfileRow[]): UserProfileRow[] {
  return rows.filter(r => r.profile_type === 'experience')
}

export function getDecisionFactorRows(rows: UserProfileRow[]): UserProfileRow[] {
  return rows.filter(r => r.profile_type === 'decision_factor')
}

// Returns top N experience labels with positive preference score.
// Sort: preference_score DESC → confidence DESC → category order → sort_order.
export function getTopExperienceLabels(rows: UserProfileRow[], n = 3): UserProfileRow[] {
  const CATEGORY_ORDER: Record<string, number> = { occasion: 1, atmosphere: 2, experience: 3 }
  return getExperienceRows(rows)
    .filter(r => r.preference_score !== null && r.preference_score > 0)
    .sort((a, b) => {
      const scoreDiff = (b.preference_score ?? 0) - (a.preference_score ?? 0)
      if (scoreDiff !== 0) return scoreDiff
      const confDiff = b.confidence - a.confidence
      if (confDiff !== 0) return confDiff
      const catDiff = (CATEGORY_ORDER[a.category ?? ''] ?? 9) - (CATEGORY_ORDER[b.category ?? ''] ?? 9)
      if (catDiff !== 0) return catDiff
      return a.sort_order - b.sort_order
    })
    .slice(0, n)
}

// Returns top N decision factors with positive importance score.
// Negative direction is NOT filtered out — even negative direction shows what matters to the user.
// Sort: importance_score DESC → confidence DESC → evidence_count DESC → sort_order.
export function getTopDecisionFactors(rows: UserProfileRow[], n = 2): UserProfileRow[] {
  return getDecisionFactorRows(rows)
    .filter(r => r.importance_score !== null && r.importance_score > 0)
    .sort((a, b) => {
      const impDiff = (b.importance_score ?? 0) - (a.importance_score ?? 0)
      if (impDiff !== 0) return impDiff
      const confDiff = b.confidence - a.confidence
      if (confDiff !== 0) return confDiff
      const evDiff = b.evidence_count - a.evidence_count
      if (evDiff !== 0) return evDiff
      return a.sort_order - b.sort_order
    })
    .slice(0, n)
}
