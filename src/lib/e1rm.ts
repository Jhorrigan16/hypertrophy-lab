/**
 * Epley estimated 1RM. Only appropriate for moderate rep ranges.
 * Labeled as estimate — never treat as measured max.
 */
export function epleyE1rm(weight: number, reps: number): number | null {
  if (weight <= 0 || reps <= 0) return null
  // Unreliable outside ~1–12; still compute but callers should label
  return weight * (1 + reps / 30)
}

export function isE1rmAppropriate(reps: number): boolean {
  return reps >= 1 && reps <= 12
}

export function bestE1rmEstimate(
  sets: Array<{ weight: number; reps: number; isWarmup?: boolean; isComplete?: boolean }>,
): number | null {
  let best: number | null = null
  for (const s of sets) {
    if (s.isWarmup || s.isComplete === false) continue
    if (!isE1rmAppropriate(s.reps)) continue
    const est = epleyE1rm(s.weight, s.reps)
    if (est != null && (best == null || est > best)) best = est
  }
  return best
}
