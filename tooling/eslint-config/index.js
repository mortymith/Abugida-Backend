// @ts-check

/**
 * Shared ESLint configuration for the Abugida monorepo.
 *
 * Framework-agnostic by design: no Astro, TanStack, React, or Hono behavior
 * belongs here. Framework extensions stay in the consuming workspace
 * (`app/marketing` → eslint-plugin-astro, `app/dashboard` →
 * @tanstack/eslint-config).
 *
 * This package is the single source of truth for the repository's lint
 * policy. There is no root ESLint config: every workspace owns an
 * `eslint.config.*` that composes what it needs from here.
 *
 * Exports:
 * - `globalIgnores` — the ignore list every workspace shares.
 * - `sharedRules` — the repository-wide rule set (no drift between apps and
 *   packages).
 * - `sharedRulesConfig(...)` — the shared rules as a config block, with the
 *   plugin that implements them (for workspaces that compose a preset).
 * - `typescriptFiles` — the glob the TypeScript rules apply to. Framework
 *   specific file types (`.astro`, ...) are linted by their own plugins.
 * - `tseslint` — re-export of `typescript-eslint` so workspaces compose
 *   configs without declaring their own (drifting) copies of the plugin.
 * - `typescriptProject(...)` — factory for a type-aware lint block.
 * - `default` — the base flat config: ignores + typescript-eslint
 *   recommended + the shared rules. Composed by workspaces that lint
 *   TypeScript themselves.
 */
import tseslint from 'typescript-eslint'

export { tseslint }

/** File globs the TypeScript rules apply to. */
export const typescriptFiles = ['**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}']

/** Ignores shared by every consumer. Keep in sync with .prettierignore intent. */
export const globalIgnores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.turbo/**',
  '**/.git/**',
  '**/*.gen.ts',
  '**/.astro/**',
  '**/.env',
  '**/.env.*',
  '!**/.env.example',
  '**/*.tsbuildinfo',
]

/**
 * Rules shared by every workspace in the repository.
 *
 * - underscore-prefixed parameters and variables may stay unused: `_` is
 *   the repository-wide marker for "intentionally ignored".
 * - type-only imports keep Bun's transpiler and bundlers honest.
 */
export const sharedRules = {
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
  ],
  // `disallowTypeAnnotations` is off on purpose: the rule exists here to keep
  // type-only imports marked as such (Bun's transpiler and the bundlers
  // rely on it), not to ban inline `import()` type annotations.
  '@typescript-eslint/consistent-type-imports': [
    'warn',
    { prefer: 'type-imports', disallowTypeAnnotations: false },
  ],
}

/**
 * Config block that applies the shared rules and registers the plugin that
 * implements them.
 *
 * Workspaces that build on another preset (TanStack, Astro) use this
 * instead of spreading `sharedRules` by hand: flat config resolves a rule
 * against the plugin registered in the *same* configuration object, so the
 * plugin has to be declared next to the rules.
 *
 * @param {object} [options]
 * @param {string[]} [options.files] - glob(s) the block applies to
 * @param {Record<string, unknown>} [options.rules] - extra rules merged on
 *   top of the shared ones
 * @param {boolean} [options.plugin] - register the `@typescript-eslint`
 *   plugin next to the rules. Set to `false` when the workspace composes a
 *   preset that already registers the plugin (TanStack): flat config
 *   rejects a plugin that is redefined with a different instance.
 * @returns {import('eslint').Linter.Config}
 */
export function sharedRulesConfig({ files, rules = {}, plugin = true } = {}) {
  return {
    name: 'abugida/shared-rules',
    ...(files ? { files } : {}),
    ...(plugin ? { plugins: { '@typescript-eslint': tseslint.plugin } } : {}),
    rules: { ...sharedRules, ...rules },
  }
}

/**
 * Type-aware block for workspaces that lint with a tsconfig project.
 *
 * Composes with the base config: the base provides the rules, this block
 * only adds type information.
 *
 * @param {object} options
 * @param {string[]} [options.files] - glob(s) this block applies to
 * @param {string | boolean | string[]} [options.project] - passed to
 *   parserOptions.project (`true` finds the nearest tsconfig, or a path)
 * @param {string} [options.tsconfigRootDir] - usually `import.meta.dirname`
 *   of the consuming config file
 * @returns {import('eslint').Linter.Config}
 */
export function typescriptProject({
  files = typescriptFiles,
  project = true,
  tsconfigRootDir,
} = {}) {
  return {
    name: 'abugida/typescript-project',
    files,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project,
        // Explicit anchor for @typescript-eslint/parser: newer parser
        // versions refuse to guess when several candidate tsconfig roots are
        // visible in one process. The anchor belongs to the consuming
        // workspace because only it knows which tsconfig governs the files.
        ...(tsconfigRootDir ? { tsconfigRootDir } : {}),
      },
    },
  }
}

/**
 * Base flat config. Non-type-aware on purpose: it is the shared baseline
 * every workspace composes, and it also backs the repository-level lint
 * run for files that no workspace owns. Workspaces that want type-aware
 * linting add a `typescriptProject(...)` block on top.
 */
export default tseslint.config(
  {
    name: 'abugida/global-ignores',
    ignores: globalIgnores,
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    name: config.name ? `abugida/${config.name}` : 'abugida/typescript-recommended',
    files: typescriptFiles,
  })),
  sharedRulesConfig({ files: typescriptFiles }),
)
