// @ts-check

/**
 * Repository-level lint-staged configuration for the Abugida monorepo.
 *
 * The pre-commit pipeline is the fast path for developers; the full
 * repository validation always uses the `pnpm lint*` commands. This config
 * is the single source of truth for what runs on staged files.
 *
 * Owned by the repository root: lint-staged discovers
 * `lint-staged.config.js` in the working directory, so the husky
 * `pre-commit` hook needs no `--config` flag.
 *
 * Routing rules:
 * - Files that belong to a workspace (app/*, packages/*) are linted with
 *   that workspace's own ESLint config, because every workspace owns its
 *   lint policy and composes the shared base from `@abugida/eslint-config`.
 * - Files owned by the tooling layer are linted with the tooling layer's
 *   own ESLint config (`tooling/eslint.config.js`).
 * - Formatting follows the workspace's own `format` script: workspaces that
 *   format with `bun fmt` (bunfig.toml `[fmt]` policy) are formatted with
 *   `bun fmt --cwd <workspace>`, while Prettier workspaces are formatted
 *   with the shared config (`@abugida/prettier-config`). Either way staged
 *   files end up formatted exactly like the workspace `format` scripts
 *   format them.
 *
 * The workspace list is discovered from the filesystem instead of being
 * hard-coded, so a new workspace is covered by the pre-commit hook without
 * touching this file.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Repository root (this file lives in the repository root). */
const repoRoot = path.dirname(fileURLToPath(import.meta.url))

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

/**
 * Does the workspace format with `bun fmt`?
 *
 * The workspace package manifest is the source of truth: every workspace
 * owns a `format` script, and the ones that start with `bun fmt` own their
 * formatting through bun's built-in formatter (the `[fmt]` policy in the
 * workspace `bunfig.toml`) instead of Prettier.
 *
 * @param {string} workspace
 * @returns {boolean}
 */
function usesBunFmt(workspace) {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, workspace, 'package.json'), 'utf8'),
    )
    const format = manifest.scripts?.format
    return typeof format === 'string' && format.startsWith('bun fmt')
  } catch {
    return false
  }
}

/**
 * Build a `bun fmt` command bound to one workspace.
 *
 * `bun fmt` resolves its `[fmt]` policy from the bunfig.toml in the working
 * directory, and lint-staged runs from the repository root — so the command
 * pins `--cwd` to the workspace and rewrites the repo-relative paths that
 * lint-staged hands over into workspace-relative ones.
 *
 * Like `onlyExisting`, files deleted in the current commit are skipped.
 *
 * @param {string} workspace
 * @returns {(files: string[]) => string}
 */
function bunFmt(workspace) {
  return (files) => {
    const prefix = `${workspace.replaceAll('\\', '/')}/`
    const existing = files
      .filter((file) => fs.existsSync(file))
      .map((file) => {
        const normalized = toRepoRelative(file)
        return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized
      })
    if (existing.length === 0) return ''
    return ['bun fmt', `--cwd ${workspace}`, ...existing.map((file) => JSON.stringify(file))].join(
      ' ',
    )
  }
}

/**
 * Normalize a lint-staged file argument to a repository-relative path.
 *
 * lint-staged passes absolute paths, while the routing rules in this file
 * (workspace prefixes, owned directories) are expressed repo-relative.
 *
 * @param {string} file
 * @returns {string}
 */
function toRepoRelative(file) {
  const normalized = file.replaceAll('\\', '/')
  if (!path.isAbsolute(normalized)) return normalized
  return path.relative(repoRoot, normalized).split(path.sep).join('/')
}

/**
 * Directories whose files are linted and formatted by their own owner.
 *
 * The repository-level patterns below use a leading `*`, which lint-staged
 * matches against the basename — so they also match files inside a
 * workspace. Those files are handled by the workspace patterns and must not
 * be linted a second time with the tooling configuration.
 */
const ownedDirectories = ['app/', 'packages/', 'tooling/', 'docs/']

/**
 * Wrap a command so that it only runs on repository-level files.
 *
 * @param {string} command
 * @returns {(files: string[]) => string}
 */
function onlyRepositoryFiles(command) {
  return (files) => {
    const owned = files.filter(
      (file) => !ownedDirectories.some((directory) => toRepoRelative(file).startsWith(directory)),
    )
    if (owned.length === 0) return ''
    return [command, ...owned.map((file) => JSON.stringify(file))].join(' ')
  }
}

/** @type {import('lint-staged').Configuration} */
const config = {}

// Source code owned by a workspace: that workspace's ESLint config wins.
// Everything else in a workspace: formatting only, with the formatter the
// workspace itself uses (`bun fmt` or Prettier — see `usesBunFmt`).
for (const workspace of discoverWorkspaces()) {
  const formatWithBun = usesBunFmt(workspace)

  // bun fmt does not format Astro files — only Prettier (with the Astro
  // plugin) does — so `.astro` is only routed to Prettier workspaces.
  const extensions =
    !formatWithBun && hasAstroSupport(workspace) ? [...codeExtensions, 'astro'] : codeExtensions

  const formatter = formatWithBun ? bunFmt(workspace) : onlyExisting('prettier --write')

  const commands = hasEslintConfig(workspace)
    ? [`pnpm --dir ${workspace} exec eslint --fix --no-warn-ignored`, formatter]
    : [formatter]

  config[`${workspace}/**/*.{${extensions.join(',')}}`] = commands
  config[`${workspace}/**/*.{${assetExtensions.join(',')}}`] = [formatter]
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
  onlyRepositoryFiles('eslint --fix --no-warn-ignored --config tooling/eslint.config.js'),
  onlyRepositoryFiles('prettier --write --config tooling/prettier-config/index.js'),
]
config['*.{json,jsonc,md,mdx,yaml,yml,css,scss,html,graphql}'] = [
  onlyRepositoryFiles('prettier --write --config tooling/prettier-config/index.js'),
]
config['docs/**/*.{md,mdx,json,yaml,yml}'] = [
  onlyExisting('prettier --write --config tooling/prettier-config/index.js'),
]

// Shell scripts are formatted with shfmt (system binary), not Prettier.
config[`**/*.{${shellExtensions.join(',')}}`] = [onlyExisting('shfmt -w -i 2 -sr -ln bash')]

export default config
