// @ts-check

/**
 * ESLint configuration for the observability package.
 *
 * Rules come from the shared tooling layer (`@abugida/eslint-config`); this
 * file adds the package's type-aware project and its local ignores.
 */
import base, { typescriptProject } from '@abugida/eslint-config'

export default [
  ...base,
  {
    name: 'abugida/observability/ignores',
    ignores: ['dist/**', 'node_modules/**', 'tests/**', 'examples/**'],
  },
  typescriptProject({
    files: ['src/**/*.ts'],
    project: true,
    tsconfigRootDir: import.meta.dirname,
  }),
]
