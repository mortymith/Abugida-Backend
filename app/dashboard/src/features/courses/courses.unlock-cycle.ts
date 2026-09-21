/**
 * Unlock-rule cycle detection (spec 04 S-2.15) — pure graph walk over the
 * whole course's requirement edges. A save that introduces a loop back to
 * any lesson in the chain is rejected with the offending cycle highlighted.
 */

export interface UnlockEdge {
  /** The locked lesson. */
  lessonId: string
  /** The lesson that must be satisfied first. */
  requiredLessonId: string
}

export interface CycleCheckResult {
  ok: boolean
  /** publicIds of lessons participating in the first detected cycle. */
  cycle: string[]
}

export function detectUnlockCycle(
  proposed: UnlockEdge[],
  existing: UnlockEdge[],
): CycleCheckResult {
  const adjacency = new Map<string, string[]>()
  const addEdge = (from: string, to: string) => {
    const list = adjacency.get(from) ?? []
    list.push(to)
    adjacency.set(from, list)
  }
  for (const edge of existing) addEdge(edge.lessonId, edge.requiredLessonId)
  for (const edge of proposed) {
    if (edge.lessonId === edge.requiredLessonId) {
      return { ok: false, cycle: [edge.lessonId] }
    }
    addEdge(edge.lessonId, edge.requiredLessonId)
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const stack: string[] = []

  const walk = (node: string): string[] | null => {
    if (visiting.has(node)) {
      const start = stack.indexOf(node)
      return start >= 0 ? stack.slice(start) : [node]
    }
    if (visited.has(node)) return null
    visiting.add(node)
    stack.push(node)
    for (const next of adjacency.get(node) ?? []) {
      const cycle = walk(next)
      if (cycle) return cycle
    }
    stack.pop()
    visiting.delete(node)
    visited.add(node)
    return null
  }

  for (const node of adjacency.keys()) {
    const cycle = walk(node)
    if (cycle) return { ok: false, cycle }
  }
  return { ok: true, cycle: [] }
}

/**
 * Auto-generated student-facing lock message (spec: auto-generated but
 * editable per lesson).
 */
export function buildLockMessage(
  requirements: Array<{
    lessonTitle: string
    condition: 'viewed' | 'completed' | 'quiz_score'
    thresholdPercent: number | null
  }>,
): string {
  if (requirements.length === 0) return ''
  const parts = requirements.map((requirement) => {
    if (requirement.condition === 'quiz_score') {
      return `score ${requirement.thresholdPercent ?? 70}%+ on ${requirement.lessonTitle}`
    }
    if (requirement.condition === 'completed') {
      return `complete ${requirement.lessonTitle}`
    }
    return `view ${requirement.lessonTitle}`
  })
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  const capitalized = list.charAt(0).toUpperCase() + list.slice(1)
  return `${capitalized} to unlock this lesson.`
}
