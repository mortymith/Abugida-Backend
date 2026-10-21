// @ts-check

/**
 * ESLint configuration for the database package.
 *
 * Rules come from the shared tooling layer (`@abugida/eslint-config`); this
 * file adds the package's type-aware project and its local ignores.
 */
import base, { typescriptProject } from '@abugida/eslint-config'

export default [
  ...base,
  {
    name: 'abugida/database/ignores',
    ignores: ['dist/**', 'drizzle/**', 'tests/**', 'examples/**', 'drizzle.config.ts'],
  },
  typescriptProject({
    files: ['**/*.ts'],
    project: true,
    tsconfigRootDir: import.meta.dirname,
  }),
]
