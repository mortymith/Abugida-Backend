// @ts-check

/**
 * Shared lint-staged configuration for the Abugida monorepo.
 *
 * The pre-commit pipeline is the fast path for developers; the full
 * repository validation always uses the `pnpm lint*` commands. This config
 * is the single source of truth for what runs on staged files.
 *
 * There is no root lint-staged config file: the husky `pre-commit` hook
 * points lint-staged at this package
 * (`lint-staged --config tooling/lint-staged-config/index.js`).
 *
 * Routing rules:
 * - Files that belong to a workspace (app/*, packages/*) are linted with
 *   that workspace's own ESLint config, because every workspace owns its
 *   lint policy and composes the shared base from `@abugida/eslint-config`.
 * - Files owned by the tooling layer are linted with the tooling layer's
 *   own ESLint config (`tooling/eslint.config.js`).
 * - Prettier always runs with the shared config
 *   (`@abugida/prettier-config`) so staged files are formatted exactly like
 *   the workspace `format` scripts format them.
 *
 * The workspace list is discovered from the filesystem instead of being
 * hard-coded, so a new workspace is covered by the pre-commit hook without
 * touching this file.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repository root (tooling/lint-staged-config → repo root). */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Directories that contain workspaces. */
const workspaceRoots = ['app', 'packages']

/** File extensions that carry source code. */
const codeExtensions = ['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx']

/** File extensions that are formatted but not linted. */
const assetExtensions = [
  'json',
  'jsonc',
  'md',
  'mdx',
  'yaml',
  'yml',
  'css',
  'scss',
  'html',
  'graphql',
]

/** Shell scripts are formatted with shfmt, not Prettier. */
const shellExtensions = ['sh', 'bash', 'ksh', 'zsh']

/** @param {string} relativePath */
const exists = (relativePath) => fs.existsSync(path.join(repoRoot, relativePath))

/**
 * Every workspace directory that owns a package manifest.
 *
 * @returns {string[]} workspace paths relative to the repository root
 */
function discoverWorkspaces() {
  /** @type {string[]} */
  const workspaces = []

  for (const root of workspaceRoots) {
    const absoluteRoot = path.join(repoRoot, root)
    if (!fs.existsSync(absoluteRoot)) continue

    for (const entry of fs.readdirSync(absoluteRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue

      const relativePath = `${root}/${entry.name}`
      if (!exists(`${relativePath}/package.json`)) continue

      workspaces.push(relativePath)
    }
  }

  return workspaces.sort()
}

/**
 * Does the workspace own an ESLint flat config?
 *
 * @param {string} workspace
 * @returns {boolean}
 */
function hasEslintConfig(workspace) {
  return ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts'].some(
    (file) => exists(`${workspace}/${file}`),
  )
}

/**
 * Does the workspace own Astro files? Only Astro workspaces know the Astro
 * plugin, so the extension is only routed to them.
 *
 * @param {string} workspace
 * @returns {boolean}
 */
function hasAstroSupport(workspace) {
  const stack = [path.join(repoRoot, workspace)]

  while (stack.length > 0) {
    const current = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
        continue
      }
      const full = path.join(current, entry.name)
      if (entry.isFile() && entry.name.endsWith('.astro')) return true
      if (entry.isDirectory()) stack.push(full)
    }
  }

  return false
}

/**
 * Wrap a command so that files deleted in the current commit are skipped.
 *
 * ESLint and Prettier both fail with "No files matching the pattern" when
 * they are handed a path that the commit deletes. lint-staged passes the
 * deleted paths through, so the command is built from the files that still
 * exist on disk.
 *
 * @param {string} command
 * @returns {(files: string[]) => string}
 */
function onlyExisting(command) {
  return (files) => {
    const existing = files.filter((file) => fs.existsSync(file))
    if (existing.length === 0) return ''
    return [command, ...existing.map((file) => JSON.stringify(file))].join(' ')
  }
}

/** @type {import('lint-staged').Configuration} */
const config = {}

// Source code owned by a workspace: that workspace's ESLint config wins.
// Everything else in a workspace: formatting only.
for (const workspace of discoverWorkspaces()) {
  const extensions = hasAstroSupport(workspace) ? [...codeExtensions, 'astro'] : codeExtensions

  const commands = hasEslintConfig(workspace)
    ? [`pnpm --dir ${workspace} exec eslint --fix --no-warn-ignored`, 'prettier --write']
    : ['prettier --write']

  config[`${workspace}/**/*.{${extensions.join(',')}}`] = commands.map(onlyExisting)
  config[`${workspace}/**/*.{${assetExtensions.join(',')}}`] = [onlyExisting('prettier --write')]
}

// The tooling layer owns its own ESLint config.
config['tooling/**/*.{js,mjs,cjs,ts,tsx,jsx}'] = [
  onlyExisting('eslint --fix --no-warn-ignored --config tooling/eslint.config.js'),
]
config['tooling/**/*.{json,jsonc,md,mdx,yaml,yml,css,scss,html,graphql}'] = [
  onlyExisting('prettier --write --config tooling/prettier-config/index.js'),
]

// Repository-level files: no workspace owns them, so the shared configs are
// referenced explicitly.
config['*.{js,mjs,cjs,ts,tsx,jsx}'] = [
  onlyExisting('eslint --fix --no-warn-ignored --config tooling/eslint.config.js'),
  onlyExisting('prettier --write --config tooling/prettier-config/index.js'),
]
config['*.{json,jsonc,md,mdx,yaml,yml,css,scss,html,graphql}'] = [
  onlyExisting('prettier --write --config tooling/prettier-config/index.js'),
]
config['docs/**/*.{md,mdx,json,yaml,yml}'] = [
  onlyExisting('prettier --write --config tooling/prettier-config/index.js'),
]

// Shell scripts are formatted with shfmt (system binary), not Prettier.
config[`**/*.{${shellExtensions.join(',')}}`] = [onlyExisting('shfmt -w -i 2 -sr -ln bash')]

export default config
