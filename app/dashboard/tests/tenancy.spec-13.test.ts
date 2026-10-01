/**
 * Tenancy contract for the shell-visible surfaces (spec 13, spec 02 S-A.1).
 *
 * A workspace is a first-class scope, not a filter the UI applies. These tests
 * cover the parts that can be checked without a database, and they run at commit
 * time on purpose: an unscoped write or a session-less workspace lookup is a bug
 * that should never need a deploy to discover.
 *
 * Read scoping is enforced in code (see `activeWorkspaceScope()` in
 * `courses.server-helpers.server.ts` and its media twin), not here — reads
 * compose their predicate through a `filters` array, so no static scan of the
 * source can tell a scoped query from an unscoped one. Surfaces still awaiting
 * scope are listed in `docs/tenancy.md`.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC_ROOT = join(import.meta.dir, '..', 'src')

function sourceFiles(dir = SRC_ROOT): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out.sort()
}

const files = sourceFiles()

/** Splits a file into statement-sized chunks (statements are blank-line separated). */
function statements(text: string): string[] {
  return text.split(/\n\s*\n/)
}

describe('workspace-stamped writes', () => {
  test('every course insert stamps the owning workspace', () => {
    const offenders: string[] = []
    for (const file of files) {
      for (const chunk of statements(readFileSync(file, 'utf8'))) {
        if (!/\.insert\(courses\)/.test(chunk)) continue
        if (/organizationId:/.test(chunk)) continue
        offenders.push(relative(SRC_ROOT, file))
      }
    }
    expect(offenders).toEqual([])
  })

  test('every asset insert stamps the owning workspace', () => {
    const offenders: string[] = []
    for (const file of files) {
      for (const chunk of statements(readFileSync(file, 'utf8'))) {
        if (!/\.insert\(assetLibrary\)/.test(chunk)) continue
        if (/organizationId:/.test(chunk)) continue
        offenders.push(relative(SRC_ROOT, file))
      }
    }
    expect(offenders).toEqual([])
  })

  test('the scanner is not vacuous — it sees the known insert sites', () => {
    const inserts = files.filter((file) =>
      statements(readFileSync(file, 'utf8')).some((chunk) =>
        /\.insert\((courses|assetLibrary)\)/.test(chunk),
      ),
    )
    expect(inserts.length).toBeGreaterThanOrEqual(4)
  })
})

describe('workspace resolution', () => {
  test('the active workspace is server-derived and fails closed', () => {
    const helper = readFileSync(
      join(SRC_ROOT, 'features/workspaces/server/workspaces.impl.server.ts'),
      'utf8',
    )
    expect(helper).toMatch(/export async function requireActiveOrganizationIdImpl/)
    // The throw is the tenancy boundary: an unfiltered fallback must not exist.
    expect(helper).toContain('NO_ACTIVE_WORKSPACE')
  })

  test('course and media reads share one workspace guard', () => {
    const coursesHelper = readFileSync(
      join(SRC_ROOT, 'features/courses/server/courses.server-helpers.server.ts'),
      'utf8',
    )
    const mediaHelper = readFileSync(
      join(SRC_ROOT, 'features/media/server/media.server-helpers.server.ts'),
      'utf8',
    )
    for (const source of [coursesHelper, mediaHelper]) {
      expect(source).toContain('requireActiveOrganizationIdImpl')
      // Neither may re-derive the workspace itself.
      expect(source).not.toMatch(/getRequest\(\)[\s\S]{0,160}organization/)
    }
  })
})
