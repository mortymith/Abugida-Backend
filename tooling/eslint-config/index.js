// @ts-check

/**
 * Shared ESLint configuration for the Abugida monorepo.
 *
 * Framework-agnostic by design: no Astro, TanStack, React, or Hono behavior
 * belongs here. Framework extensions stay in the consuming workspace
 * (`app/marketing` → eslint-plugin-astro, `app/dashboard` →
 * @tanstack/eslint-config).
 *
 * Exports:
 * - `globalIgnores` — the ignore list every workspace shares.
 * - `tseslint` — re-export of `typescript-eslint` so workspaces compose
 *   configs without declaring their own (drifting) copies of the plugin.
 * - `typescriptProject(...)` — factory for a type-aware lint block.
 * - `default` — the base flat config: ignores + typescript-eslint
 *   recommended + the repository's shared conventions. Used directly by the
 *   root config (which backs lint-staged) and as a building block elsewhere.
 */
import tseslint from 'typescript-eslint'

export { tseslint }

/** Ignores shared by every consumer. Keep in sync with .prettierignore intent. */
export const globalIgnores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.turbo/**',
  '**/.git/**',
  '**/*.gen.ts',
  '**/.env',
  '**/.env.*',
  '!**/.env.example',
  '**/*.tsbuildinfo',
]

/**
 * Type-aware block for workspaces that lint with a tsconfig project.
 *
 * @param {object} options
 * @param {string[]} [options.files] - glob(s) this block applies to
 * @param {string | boolean | string[]} [options.project] - passed to
 *   parserOptions.project (`true` finds the nearest tsconfig, or a path)
 * @param {string} [options.tsconfigRootDir] - usually `import.meta.dirname`
 *   of the consuming config file
 * @returns {import('eslint').Linter.Config}
 */
export function typescriptProject({ files, project = true, tsconfigRootDir } = {}) {
  return {
    ...(files ? { files } : {}),
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project,
        ...(tsconfigRootDir ? { tsconfigRootDir } : {}),
      },
    },
  }
}

/**
 * Base flat config. Non-type-aware on purpose: the root config backs
 * lint-staged, which lints files from every workspace without a single
 * tsconfig covering them. Workspaces that want type-aware linting add a
 * `typescriptProject(...)` block on top.
 */
export default tseslint.config(
  {
    ignores: globalIgnores,
  },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        // Explicit anchor for @typescript-eslint/parser: newer parser
        // versions refuse to guess when several candidate tsconfig roots are
        // visible in one process (monorepo-wide lint-staged runs). Declared
        // in the LAST block because parserOptions objects replace — not
        // deep-merge — earlier ones. No type information is requested here;
        // type-aware consumers set their own anchor via typescriptProject().
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Shared convention across packages/auth, observability and storage:
      // underscore-prefixed parameters may stay unused.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Type-only imports keep Bun's transpiler and bundlers honest.
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
)
