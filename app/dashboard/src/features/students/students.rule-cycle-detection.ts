/**
 * Multi-rule cycle detection (spec 06 § S-4.8).
 *
 * The spec: "A rule must not create a loop through any chain of rules,
 * and the graph is checked at save time. `A → B → A` (and any longer
 * cycle: A→B→C→A) is rejected with the cycle drawn. Save is blocked while
 * a cycle exists; a rule that forms a cycle when another rule is later
 * added is flagged on both rules."
 *
 * This module owns the directed-graph cycle detection using DFS.
 */

export interface RuleEdge {
  readonly ruleId: string
  readonly ruleName: string
  readonly triggerCourseId: string | null
  readonly targetCourseId: string
}

export interface DetectedCycle {
  readonly edges: readonly RuleEdge[]
  readonly path: readonly string[] // course IDs in cycle order
  readonly pathLabels: readonly string[] // course names in cycle order
  readonly closingRuleId: string
  readonly closingRuleName: string
}

/**
 * Build a directed graph from a list of rules. Each rule is an edge from
 * `triggerCourseId` to `targetCourseId`. Rules with `triggerCourseId =
 * null` (tag/cohort/account triggers) have no incoming edge and cannot
 * participate in a cycle.
 */
export function buildRuleGraph(rules: readonly RuleEdge[]): Map<string, RuleEdge[]> {
  const graph = new Map<string, RuleEdge[]>()
  for (const rule of rules) {
    if (rule.triggerCourseId === null) continue
    const edges = graph.get(rule.triggerCourseId) ?? []
    edges.push(rule)
    graph.set(rule.triggerCourseId, edges)
  }
  return graph
}

/**
 * Detect all cycles in the rule graph using DFS. Returns a list of
 * cycles, each as a path of course IDs + the rule that closes the cycle.
 *
 * A cycle is detected when a DFS reaches a node that's already on the
 * current path. The cycle is the slice of the path from the first
 * occurrence of that node to the current position, plus the closing edge.
 */
export function detectCycles(rules: readonly RuleEdge[]): DetectedCycle[] {
  const graph = buildRuleGraph(rules)
  const cycles: DetectedCycle[] = []
  const visited = new Set<string>()
  const path: string[] = []
  const pathSet = new Set<string>()

  function dfs(node: string): void {
    if (pathSet.has(node)) {
      // Found a cycle: slice the path from the first occurrence of `node`.
      const cycleStart = path.indexOf(node)
      const cyclePath = path.slice(cycleStart)
      // Find the edge that closes the cycle (from the last node in
      // cyclePath back to `node`).
      const lastNode = cyclePath[cyclePath.length - 1]
      const edges = graph.get(lastNode) ?? []
      const closingEdge = edges.find((e) => e.targetCourseId === node)
      if (closingEdge) {
        cycles.push({
          edges: cyclePath
            .map((courseId, i) => {
              const nextCourseId = cyclePath[(i + 1) % cyclePath.length]
              const edgeList = graph.get(courseId) ?? []
              return edgeList.find((e) => e.targetCourseId === nextCourseId)
            })
            .filter((e): e is RuleEdge => e !== undefined),
          path: [...cyclePath, node],
          pathLabels: cyclePath.map(() => ''), // filled by caller with course names
          closingRuleId: closingEdge.ruleId,
          closingRuleName: closingEdge.ruleName,
        })
      }
      return
    }
    if (visited.has(node)) return

    visited.add(node)
    path.push(node)
    pathSet.add(node)

    const edges = graph.get(node) ?? []
    for (const edge of edges) {
      dfs(edge.targetCourseId)
    }

    path.pop()
    pathSet.delete(node)
  }

  for (const courseId of graph.keys()) {
    if (!visited.has(courseId)) {
      dfs(courseId)
    }
  }

  return cycles
}

/**
 * Whether adding `newRule` to `existingRules` would create a cycle. This
 * is the save-time check.
 */
export function wouldCreateCycle(newRule: RuleEdge, existingRules: readonly RuleEdge[]): boolean {
  const allRules = [...existingRules, newRule]
  return detectCycles(allRules).length > 0
}

/**
 * Validate that a rule doesn't create a cycle. Returns `null` when valid,
 * or an error message naming the cycle.
 */
export function validateRuleNoCycle(
  newRule: RuleEdge,
  existingRules: readonly RuleEdge[],
): { valid: boolean; cycle: DetectedCycle | null } {
  const cycles = detectCycles([...existingRules, newRule])
  if (cycles.length === 0) {
    return { valid: true, cycle: null }
  }
  return { valid: false, cycle: cycles[0] }
}

/**
 * The cycle-rejection message. The spec: "This rule would re-enroll
 * students forever. Remove the loop, or exclude students already enrolled
 * in TOEFL Complete."
 */
export function cycleRejectionMessage(_cycle: DetectedCycle): string {
  return 'This rule would re-enroll students forever. Remove the loop.'
}

/**
 * The cycle path label for the diagram. The spec: the cycle is rendered
 * as a small graph with the loop highlighted, and the text alternative
 * lists the loop in reading order: "TOEFL Complete → IELTS Advanced →
 * TOEFL Complete".
 */
export function cyclePathLabel(
  cycle: DetectedCycle,
  courseNames: ReadonlyMap<string, string>,
): string {
  const labels = cycle.path.map((courseId) => courseNames.get(courseId) ?? courseId)
  return labels.join(' → ')
}

/**
 * Find all rules that participate in any cycle. Used to flag both rules
 * when a later rule creates a cycle (spec: "flagged on both rules").
 */
export function rulesInCycles(rules: readonly RuleEdge[]): Set<string> {
  const cycles = detectCycles(rules)
  const ruleIds = new Set<string>()
  for (const cycle of cycles) {
    for (const edge of cycle.edges) {
      ruleIds.add(edge.ruleId)
    }
  }
  return ruleIds
}
