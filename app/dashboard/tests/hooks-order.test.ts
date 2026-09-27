import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Structural guard for React's Rules of Hooks.
 *
 * The dashboard's ESLint setup resolves `@tanstack/eslint-config` to a config
 * that registers no `react-hooks` rules at all, so a hook placed after an early
 * return ships silently and only explodes in the browser with "Rendered more
 * hooks than during the previous render". This test walks every component source
 * and fails on that mistake, so it is caught in CI instead of at runtime.
 *
 * The analysis is a single pass over the source with literals masked, tracking
 * *why* each enclosing bracket exists. That distinction matters: a hook nested
 * in a call argument list (`useSensors(useSensor(A), useSensor(B))`) is still
 * evaluated unconditionally and is perfectly legal, while a hook inside an `if`
 * block, a ternary branch, behind `&&`, or after an early `return` is not.
 */

const COMPONENT_ROOT = join(import.meta.dir, '..', 'src')
const GENERATED_FILES = new Set(['routeTree.gen.ts'])

/** Keywords whose block or parenthesis is only entered on some renders. */
const CONTROL_KEYWORDS = ['if', 'for', 'while', 'switch', 'catch', 'with']

/**
 * Replace comment, string, template and regex literal contents with spaces,
 * preserving offsets and line breaks so brace scanning stays aligned.
 */
export function maskLiterals(source: string): string {
  const chars = [...source]
  const out = chars.slice()
  let i = 0
  let lastSignificant = ''

  const blank = (index: number) => {
    if (chars[index] !== '\n') out[index] = ' '
  }

  while (i < chars.length) {
    const ch = chars[i]
    const next = chars[i + 1]

    if (ch === '/' && next === '/') {
      while (i < chars.length && chars[i] !== '\n') blank(i++)
      continue
    }

    if (ch === '/' && next === '*') {
      blank(i)
      blank(i + 1)
      i += 2
      while (i < chars.length && !(chars[i] === '*' && chars[i + 1] === '/')) {
        blank(i)
        i++
      }
      if (i < chars.length) {
        blank(i)
        blank(i + 1)
        i += 2
      }
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      blank(i)
      i++
      while (i < chars.length && chars[i] !== quote) {
        // Template interpolations are real code and must stay visible.
        if (quote === '`' && chars[i] === '$' && chars[i + 1] === '{') {
          let depth = 1
          i += 2
          while (i < chars.length && depth > 0) {
            if (chars[i] === '{') depth++
            else if (chars[i] === '}') depth--
            if (depth > 0) i++
          }
          i++
          continue
        }
        if (chars[i] === '\\') {
          blank(i)
          i++
        }
        if (i < chars.length) blank(i)
        i++
      }
      if (i < chars.length) blank(i)
      i++
      lastSignificant = quote
      continue
    }

    if (ch === '/' && /[(=,;:!&|?{}[\]>+*%~^]/.test(lastSignificant)) {
      blank(i)
      i++
      let inClass = false
      while (i < chars.length) {
        const c = chars[i]
        if (c === '\\') {
          blank(i)
          if (i + 1 < chars.length) blank(i + 1)
          i += 2
          continue
        }
        if (c === '[') inClass = true
        else if (c === ']') inClass = false
        else if (c === '/' && !inClass) break
        else if (c === '\n') break
        blank(i)
        i++
      }
      if (i < chars.length) blank(i)
      i++
      lastSignificant = '/'
      continue
    }

    if (!/\s/.test(ch)) lastSignificant = ch
    i++
  }

  return out.join('')
}

type GroupKind =
  /** `if` / `for` / `while` / `switch` / `catch` / `else` / `try`: conditional. */
  | 'control'
  /** Ternary branch, or the right-hand side of `&&` / `||`: conditional. */
  | 'conditional'
  /** Function body, object literal, call arguments, JSX children: always run. */
  | 'plain'

interface Group {
  kind: GroupKind
}

interface FunctionSpan {
  name: string
  bodyStart: number
  bodyEnd: number
  /** Absolute brace depth of the body's contents. */
  bodyDepth: number
}

export interface HookSite {
  name: string
  index: number
  line: number
  functionName: string
  /** Enclosing control-flow blocks (`if`, `for`, `catch`, …), outermost first. */
  enclosingKinds: GroupKind[]
  /** Hook is in a ternary branch or behind `&&` / `||`. */
  conditionalExpression: boolean
  /** Line of the early exit preceding this hook at the same nesting level. */
  guardLine: number
}

export type HookOrderReason = 'after-early-return' | 'conditional-block' | 'conditional-expression'

export interface HookOrderViolation extends HookSite {
  reason: HookOrderReason
}

/** Index of the `{` matching the `{` at `braceIndex`, or -1. */
function matchBrace(masked: string, braceIndex: number): number {
  let depth = 0
  for (let i = braceIndex; i < masked.length; i++) {
    const ch = masked[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** Absolute brace depth at each character index. */
function prefixDepths(masked: string): number[] {
  const depths = new Array<number>(masked.length + 1)
  let depth = 0
  for (let i = 0; i < masked.length; i++) {
    depths[i] = depth
    if (masked[i] === '{') depth++
    else if (masked[i] === '}') depth--
  }
  depths[masked.length] = depth
  return depths
}

function lineStarts(masked: string): number[] {
  const starts = [0]
  for (let i = 0; i < masked.length; i++) if (masked[i] === '\n') starts.push(i + 1)
  return starts
}

function lineAt(starts: number[], index: number): number {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (starts[mid] <= index) low = mid
    else high = mid - 1
  }
  return low + 1
}

/**
 * Index of the `{` opening a function body, scanning from just after the
 * function name or parameter list. Returns -1 when there is no body.
 *
 * Return type annotations are the subtlety: in
 * `function F(props: { a: string }): { b: string } {` the braces around `a` and
 * `b` belong to types. A naive "first brace at depth 0" search mis-attributes the
 * nesting level, which then makes every one of the function's hooks look
 * conditionally placed.
 */
function findBodyBrace(masked: string, from: number): number {
  let i = from
  while (i < masked.length) {
    const ch = masked[i]

    if (ch === '(' || ch === '[' || ch === '<') {
      const close = ch === '(' ? ')' : ch === '[' ? ']' : '>'
      let depth = 0
      while (i < masked.length) {
        const c = masked[i]
        if (c === ch) depth++
        else if (c === close) {
          depth--
          if (depth === 0) {
            i++
            break
          }
        }
        i++
      }
      continue
    }

    // Return type annotation: consume it so its object braces are not mistaken
    // for the body.
    if (ch === ':') {
      i = skipTypeAnnotation(masked, i + 1)
      if (i === -1) return -1
      continue
    }

    // Arrow function body.
    if (ch === '=' && masked[i + 1] === '>') {
      const next = nextMeaningful(masked, i + 2)
      if (next === -1) return -1
      return masked[next] === '{' ? next : -1
    }

    if (ch === '{') return i
    if (ch === ';' || ch === '=') return -1
    if (ch === '\n') {
      const next = nextMeaningful(masked, i)
      if (next === -1) return -1
      // The signature may wrap onto the next line; anything else ends it.
      if (!/[(<{:]/.test(masked[next])) return -1
    }
    i++
  }
  return -1
}

function skipTypeAnnotation(masked: string, from: number): number {
  let i = from
  let angle = 0
  while (i < masked.length) {
    const ch = masked[i]
    if (ch === '{') {
      const end = matchBrace(masked, i)
      if (end === -1) return -1
      i = end + 1
      continue
    }
    if (ch === '<' || ch === '(' || ch === '[') {
      angle++
      i++
      continue
    }
    if (ch === '>' || ch === ')' || ch === ']') {
      if (angle === 0) return i
      angle--
      i++
      continue
    }
    if (ch === '=' && masked[i + 1] === '>') {
      i += 2
      continue
    }
    if (ch === '\n') {
      const next = nextMeaningful(masked, i)
      if (next === -1) return -1
      if (masked[next] === '{') return i
      if (!/[A-Za-z0-9_$|&.[<(]/.test(masked[next])) return i
    }
    if (ch === '=') return i
    i++
  }
  return -1
}

function nextMeaningful(masked: string, from: number): number {
  for (let i = from; i < masked.length; i++) {
    if (!/\s/.test(masked[i])) return i
  }
  return -1
}

/** Function declarations may be anonymous; label those so reports stay readable. */
function nameOrAnonymous(name: string | undefined): string {
  return name ?? '(anonymous)'
}

/**
 * Function forms worth tracking. Each pattern must consume the whole signature
 * up to the arrow or the parameter list, so `findBodyBrace` starts looking at
 * the body rather than at the destructuring braces of the parameters.
 */
const FUNCTION_PATTERNS: RegExp[] = [
  /(?:^|[\s;}])(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)?/g,
  /(?:^|[\s;}])(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::[^=]*?)?=\s*(?:async\s+)?function\s*\*?\s*[(<]/g,
  // `const X = (…) => {`, including multi-line and destructured parameters.
  /(?:^|[\s;}])(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::[^=]*?)?=\s*(?:async\s*)?\((?:[^()]|\([^()]*\))*\)\s*(?::[^=]*?)?=>/g,
  // `const X = arg => {`
  /(?:^|[\s;}])(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::[^=]*?)?=\s*(?:async\s+)?[A-Za-z0-9_$]+\s*=>/g,
]

function collectFunctionSpans(masked: string, depths: number[]): FunctionSpan[] {
  const spans: FunctionSpan[] = []
  for (const pattern of FUNCTION_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(masked)) !== null) {
      const bodyBrace = findBodyBrace(masked, match.index + match[0].length)
      if (bodyBrace === -1) continue
      const bodyEnd = matchBrace(masked, bodyBrace)
      if (bodyEnd === -1) continue
      // The declaration pattern's capture group is optional: a function
      // declaration may be anonymous.
      spans.push({
        name: nameOrAnonymous(match[1]),
        bodyStart: bodyBrace,
        bodyEnd,
        bodyDepth: depths[bodyBrace] + 1,
      })
    }
  }
  return spans
}

/** True when the bracket at `openIndex` belongs to a control-flow construct. */
export function isControlBracket(masked: string, openIndex: number): boolean {
  const keyword = new RegExp(`\\b(?:${CONTROL_KEYWORDS.join('|')})\\s*$`)

  // Look at the last non-whitespace character before the bracket.
  let before = openIndex - 1
  while (before >= 0 && /\s/.test(masked[before])) before--
  if (before < 0) return false

  if (keyword.test(masked.slice(0, before + 1))) return true
  if (/\b(?:else|do|try|finally)\s*$/.test(masked.slice(0, before + 1))) return true

  // `if (cond) {` — find the parenthesis group that ends right before the brace.
  if (masked[before] === ')') {
    let depth = 0
    for (let i = before; i >= 0; i--) {
      const ch = masked[i]
      if (ch === ')') depth++
      else if (ch === '(') {
        depth--
        if (depth === 0) return keyword.test(masked.slice(0, i))
      }
    }
  }

  return false
}

/** True when `useSomething(` or `useSomething<` starts at `index`. */
function isHookStart(masked: string, index: number): { name: string; length: number } | null {
  if (masked.startsWith('use', index) === false) return null
  if (index > 0 && /[A-Za-z0-9_$.]/.test(masked[index - 1])) return null
  let i = index + 3
  if (i >= masked.length) return null
  if (!/[A-Z]/.test(masked[i])) return null
  while (i < masked.length && /[A-Za-z0-9_$]/.test(masked[i])) i++
  const name = masked.slice(index, i)
  while (i < masked.length && /\s/.test(masked[i])) i++
  if (masked[i] !== '(' && masked[i] !== '<') return null
  return { name, length: i - index }
}

/**
 * Locate every hook call together with the context needed to judge whether it is
 * reached on every render.
 */
export function findHookSites(source: string): HookSite[] {
  const masked = maskLiterals(source)
  const depths = prefixDepths(masked)
  const starts = lineStarts(masked)
  const spans = collectFunctionSpans(masked, depths).sort((a, b) => a.bodyStart - b.bodyStart)

  const sites: HookSite[] = []
  const stack: Group[] = []
  const active: FunctionSpan[] = []
  let nextSpan = 0

  const enclosingKinds = () => stack.filter((g) => g.kind !== 'plain').map((g) => g.kind)

  for (let i = 0; i < masked.length; i++) {
    while (nextSpan < spans.length && spans[nextSpan].bodyStart <= i) {
      active.push(spans[nextSpan])
      nextSpan++
    }
    while (active.length > 0 && i > active[active.length - 1].bodyEnd) active.pop()

    const hook = isHookStart(masked, i)
    if (hook && active.length > 0) {
      const owner = active[active.length - 1]
      sites.push({
        name: hook.name,
        index: i,
        line: lineAt(starts, i),
        functionName: owner.name,
        enclosingKinds: enclosingKinds(),
        conditionalExpression: isConditionalExpression(masked, i),
        guardLine: precedingGuardLine(masked, starts, depths, i, owner),
      })
      continue
    }

    const ch = masked[i]
    if (ch === '{') {
      stack.push({ kind: isControlBracket(masked, i) ? 'control' : 'plain' })
      continue
    }
    if (ch === '(' || ch === '[') {
      stack.push({ kind: 'plain' })
      continue
    }
    if (ch === ')' || ch === ']' || ch === '}') stack.pop()
  }

  return sites
}

/**
 * True when the hook sits in a position that is only evaluated sometimes: the
 * right-hand side of `&&` / `||`, or a ternary branch.
 *
 * This is decided from the text immediately before the hook rather than from a
 * bracket stack, because an operator's reach ends with its expression. Tracking
 * `||` across lines would wrongly mark every hook after
 * `const canWrite = role === 'admin' || role === 'editor'` as conditional.
 */
function isConditionalExpression(masked: string, index: number): boolean {
  let lineStart = index
  while (lineStart > 0 && masked[lineStart - 1] !== '\n') lineStart--

  let prefix = masked.slice(lineStart, index)
  if (!/\S/.test(prefix)) {
    // Hook starts its own line: look at how the previous line ended.
    if (lineStart === 0) return false
    let previousStart = lineStart - 1
    while (previousStart > 0 && masked[previousStart - 1] !== '\n') previousStart--
    prefix = masked.slice(previousStart, lineStart - 1)
  }

  // Drop optional chaining and nullish coalescing, which are unconditional.
  const cleaned = prefix.replace(/\?\./g, '').replace(/\?\?/g, '')
  if (/(?:&&|\|\|)\s*$/.test(cleaned)) return true
  if (/\?\s*$/.test(cleaned)) return true
  // Ternary branch: an odd number of `?` means no `:` has closed it yet.
  const questions = (cleaned.match(/\?/g) ?? []).length
  const colons = (cleaned.match(/:/g) ?? []).length
  return questions > colons
}

const EXIT_RE = /(?:\breturn\b|\bif\s*\(|\bswitch\s*\(|\bfor\s*\(|\bwhile\s*\(|\bthrow\b)/

/**
 * Line of the nearest preceding statement, at the hook's own nesting level,
 * that can end the component's render early.
 */
function precedingGuardLine(
  masked: string,
  starts: number[],
  depths: number[],
  hookIndex: number,
  owner: FunctionSpan,
): number {
  const hookDepth = depths[hookIndex]
  if (hookDepth !== owner.bodyDepth) return -1

  // Start on the line *before* the hook: the hook's own line may legitimately
  // begin with `return`, as in `return useStudentsMutation(...)`.
  let i = hookIndex
  while (i > owner.bodyStart && masked[i] !== '\n') i--
  while (i > owner.bodyStart) {
    let lineStart = i
    while (lineStart > owner.bodyStart && masked[lineStart - 1] !== '\n') lineStart--
    if (lineStart <= owner.bodyStart) break
    const lineEnd = masked.indexOf('\n', lineStart)
    const text = masked.slice(lineStart, lineEnd === -1 ? masked.length : lineEnd)
    const depth = depths[lineStart]

    if (depth === hookDepth) {
      if (/^\s*\}/.test(text)) return -1
      if (EXIT_RE.test(text)) return lineAt(starts, lineStart)
    } else if (depth < hookDepth) {
      return -1
    }
    i = lineStart - 1
  }
  return -1
}

export function findHookOrderViolations(source: string): HookOrderViolation[] {
  const violations: HookOrderViolation[] = []
  for (const site of findHookSites(source)) {
    if (site.guardLine !== -1) {
      violations.push({ ...site, reason: 'after-early-return' })
      continue
    }
    if (site.enclosingKinds.includes('control')) {
      violations.push({ ...site, reason: 'conditional-block' })
      continue
    }
    if (site.conditionalExpression) {
      violations.push({ ...site, reason: 'conditional-expression' })
    }
  }
  return violations
}

function collectComponents(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collectComponents(full, acc)
      continue
    }
    if (!/\.tsx?$/.test(entry) || GENERATED_FILES.has(entry)) continue
    acc.push(full)
  }
  return acc
}

describe('rules of hooks: structural order guard', () => {
  test('flags a hook placed after an early return', () => {
    const source = [
      'export function Bad() {',
      '  const q = useQuery()',
      '  if (q.isPending) return <div />',
      '  useEffect(() => {}, [])',
      '  return <div />',
      '}',
    ].join('\n')
    const violations = findHookOrderViolations(source)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({
      functionName: 'Bad',
      name: 'useEffect',
      line: 4,
      guardLine: 3,
      reason: 'after-early-return',
    })
  })

  test('flags a hook after a guarded if-block', () => {
    const source = [
      'export function AlsoBad() {',
      '  const q = useQuery()',
      '  if (q.isError) {',
      '    return <div />',
      '  }',
      '  useEffect(() => {}, [])',
      '  return <div />',
      '}',
    ].join('\n')
    const violations = findHookOrderViolations(source)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ functionName: 'AlsoBad', line: 6, guardLine: 3 })
  })

  test('flags a hook inside a conditional block', () => {
    const source = [
      'export function Nested() {',
      '  const q = useQuery()',
      '  if (q.data) {',
      '    useEffect(() => {}, [])',
      '  }',
      '  return <div />',
      '}',
    ].join('\n')
    const violations = findHookOrderViolations(source)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ line: 4, reason: 'conditional-block' })
  })

  test('flags a hook inside a ternary branch', () => {
    const source = [
      'export function Ternary({ on }: { on: boolean }) {',
      '  return on ? useMemo(() => 1, []) : null',
      '}',
    ].join('\n')
    const violations = findHookOrderViolations(source)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ name: 'useMemo', reason: 'conditional-expression' })
  })

  test('flags a hook behind a short-circuit', () => {
    const source = [
      'export function Short({ ready }: { ready: boolean }) {',
      '  const value = ready && useMemo(() => 1, [])',
      '  return <div>{value}</div>',
      '}',
    ].join('\n')
    expect(findHookOrderViolations(source)).toHaveLength(1)
  })

  test('allows hooks declared before any early return', () => {
    const source = [
      'export function Good() {',
      '  const [n, setN] = useState(0)',
      '  useEffect(() => setN(1), [])',
      '  if (n === 0) return <div />',
      '  return <div>{n}</div>',
      '}',
    ].join('\n')
    expect(findHookOrderViolations(source)).toHaveLength(0)
  })

  test('allows hooks passed as call arguments', () => {
    const source = [
      'export function Sensors() {',
      '  const sensors = useSensors(',
      '    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),',
      '    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),',
      '  )',
      '  if (!sensors) return <div />',
      '  return <div />',
      '}',
    ].join('\n')
    expect(findHookOrderViolations(source)).toHaveLength(0)
  })

  test('allows hooks inside a useMemo callback', () => {
    const source = [
      'export function Memo() {',
      '  const rows = useMemo(() => {',
      '    return items.map((item) => item.id)',
      '  }, [items])',
      '  if (!rows) return <div />',
      '  return <div />',
      '}',
    ].join('\n')
    expect(findHookOrderViolations(source)).toHaveLength(0)
  })

  test('allows a second component in the same file with its own early return', () => {
    const source = [
      'function Field({ label }: { label: string }) {',
      '  return <input aria-label={label} />',
      '}',
      '',
      'export function View() {',
      '  const q = useQuery()',
      '  useEffect(() => {}, [])',
      '  if (q.isPending) return <div />',
      '  return <div />',
      '}',
    ].join('\n')
    expect(findHookOrderViolations(source)).toHaveLength(0)
  })

  test('handles multi-line params with an inline object type annotation', () => {
    const source = [
      'function Editor({',
      '  open,',
      '  onOpenChange,',
      '  rule,',
      '}: {',
      '  open: boolean',
      '  onOpenChange: (open: boolean) => void',
      '  rule: Row | null',
      '}) {',
      '  const [name, setName] = useState("")',
      '  const save = useSave()',
      '  if (!open) return null',
      '  return <div>{name}</div>',
      '}',
    ].join('\n')
    expect(findHookOrderViolations(source)).toHaveLength(0)
  })

  test('flags a hook after an early return in an arrow-function component', () => {
    const source = [
      'export const Arrow = ({ id }: { id: string }) => {',
      '  const [n, setN] = useState(0)',
      '  if (id === "") return null',
      '  useEffect(() => setN(1), [])',
      '  return <div>{n}</div>',
      '}',
    ].join('\n')
    const violations = findHookOrderViolations(source)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ functionName: 'Arrow', name: 'useEffect', line: 4 })
  })

  test('ignores braces, hooks and returns inside string literals', () => {
    const source = [
      'export function Templated() {',
      "  const label = 'if (x) { return }'",
      '  const q = useQuery()',
      '  useEffect(() => {}, [label])',
      '  if (q.isPending) return <div>{`${label}`}</div>',
      '  return <div />',
      '}',
    ].join('\n')
    expect(findHookOrderViolations(source)).toHaveLength(0)
  })

  test('finds every hook in a file, not just the first', () => {
    const source = [
      'export function Many() {',
      '  const a = useState(0)',
      '  const b = useMemo(() => a, [a])',
      '  const c = useEffect(() => {}, [])',
      '  return <div />',
      '}',
    ].join('\n')
    expect(findHookSites(source).map((site) => site.name)).toEqual([
      'useState',
      'useMemo',
      'useEffect',
    ])
  })

  test('no component in the dashboard calls a hook conditionally', () => {
    const files = collectComponents(COMPONENT_ROOT)
    expect(files.length).toBeGreaterThan(0)

    const offenders: string[] = []
    for (const file of files) {
      for (const violation of findHookOrderViolations(readFileSync(file, 'utf8'))) {
        offenders.push(
          `${file.slice(COMPONENT_ROOT.length + 1)}:${violation.line} — ${violation.name}() in <${violation.functionName}> (${violation.reason}${
            violation.guardLine === -1 ? '' : `, early return at line ${violation.guardLine}`
          })`,
        )
      }
    }

    expect(offenders).toEqual([])
  })
})
