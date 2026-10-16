import { describe, expect, test } from 'bun:test'
import {
  buildRuleGraph,
  cyclePathLabel,
  cycleRejectionMessage,
  detectCycles,
  rulesInCycles,
  validateRuleNoCycle,
  wouldCreateCycle,
} from '#/features/students/students.rule-cycle-detection'
import type { RuleEdge } from '#/features/students/students.rule-cycle-detection'

function edge(ruleId: string, ruleName: string, triggerId: string, targetId: string): RuleEdge {
  return { ruleId, ruleName, triggerCourseId: triggerId, targetCourseId: targetId }
}

describe('buildRuleGraph', () => {
  test('builds directed graph from edges', () => {
    const rules = [edge('r1', 'A→B', 'c1', 'c2')]
    const graph = buildRuleGraph(rules)
    expect(graph.has('c1')).toBe(true)
    expect(graph.get('c1')).toHaveLength(1)
  })

  test('skips rules with null triggerCourseId', () => {
    const rules = [{ ruleId: 'r1', ruleName: 'tag→B', triggerCourseId: null, targetCourseId: 'c2' }]
    const graph = buildRuleGraph(rules)
    expect(graph.size).toBe(0)
  })
})

describe('detectCycles', () => {
  test('no cycle in a simple chain A→B→C', () => {
    const rules = [edge('r1', 'A→B', 'c1', 'c2'), edge('r2', 'B→C', 'c2', 'c3')]
    expect(detectCycles(rules)).toHaveLength(0)
  })

  test('detects 2-cycle A→B→A', () => {
    const rules = [edge('r1', 'A→B', 'c1', 'c2'), edge('r2', 'B→A', 'c2', 'c1')]
    const cycles = detectCycles(rules)
    expect(cycles.length).toBeGreaterThan(0)
    expect(cycles[0].closingRuleId).toBe('r2')
  })

  test('detects 3-cycle A→B→C→A', () => {
    const rules = [
      edge('r1', 'A→B', 'c1', 'c2'),
      edge('r2', 'B→C', 'c2', 'c3'),
      edge('r3', 'C→A', 'c3', 'c1'),
    ]
    const cycles = detectCycles(rules)
    expect(cycles.length).toBeGreaterThan(0)
  })

  test('no cycle when rules point to different targets', () => {
    const rules = [edge('r1', 'A→B', 'c1', 'c2'), edge('r2', 'A→C', 'c1', 'c3')]
    expect(detectCycles(rules)).toHaveLength(0)
  })

  test('self-loop A→A is a cycle', () => {
    const rules = [edge('r1', 'A→A', 'c1', 'c1')]
    const cycles = detectCycles(rules)
    expect(cycles.length).toBeGreaterThan(0)
  })
})

describe('wouldCreateCycle', () => {
  test('true when new rule closes a cycle', () => {
    const existing = [edge('r1', 'A→B', 'c1', 'c2')]
    const newRule = edge('r2', 'B→A', 'c2', 'c1')
    expect(wouldCreateCycle(newRule, existing)).toBe(true)
  })

  test('false when new rule does not close a cycle', () => {
    const existing = [edge('r1', 'A→B', 'c1', 'c2')]
    const newRule = edge('r2', 'B→C', 'c2', 'c3')
    expect(wouldCreateCycle(newRule, existing)).toBe(false)
  })
})

describe('validateRuleNoCycle', () => {
  test('valid when no cycle', () => {
    const existing = [edge('r1', 'A→B', 'c1', 'c2')]
    const newRule = edge('r2', 'B→C', 'c2', 'c3')
    const result = validateRuleNoCycle(newRule, existing)
    expect(result.valid).toBe(true)
    expect(result.cycle).toBeNull()
  })

  test('invalid when cycle created', () => {
    const existing = [edge('r1', 'A→B', 'c1', 'c2')]
    const newRule = edge('r2', 'B→A', 'c2', 'c1')
    const result = validateRuleNoCycle(newRule, existing)
    expect(result.valid).toBe(false)
    expect(result.cycle).not.toBeNull()
  })
})

describe('cycleRejectionMessage', () => {
  test('contains spec wording', () => {
    const cycles = detectCycles([edge('r1', 'A→B', 'c1', 'c2'), edge('r2', 'B→A', 'c2', 'c1')])
    const msg = cycleRejectionMessage(cycles[0])
    expect(msg).toContain('re-enroll students forever')
    expect(msg).toContain('Remove the loop')
  })
})

describe('cyclePathLabel', () => {
  test('joins course names with →', () => {
    const cycles = detectCycles([edge('r1', 'A→B', 'c1', 'c2'), edge('r2', 'B→A', 'c2', 'c1')])
    const courseNames = new Map([
      ['c1', 'TOEFL Complete'],
      ['c2', 'IELTS Advanced'],
    ])
    const label = cyclePathLabel(cycles[0], courseNames)
    expect(label).toContain('TOEFL Complete')
    expect(label).toContain('IELTS Advanced')
    expect(label).toContain('→')
  })
})

describe('rulesInCycles', () => {
  test('returns set of rule IDs in cycles', () => {
    const rules = [
      edge('r1', 'A→B', 'c1', 'c2'),
      edge('r2', 'B→A', 'c2', 'c1'),
      edge('r3', 'C→D', 'c3', 'c4'), // not in a cycle
    ]
    const inCycles = rulesInCycles(rules)
    expect(inCycles.has('r1')).toBe(true)
    expect(inCycles.has('r2')).toBe(true)
    expect(inCycles.has('r3')).toBe(false)
  })
})
