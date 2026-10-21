// @ts-check

/**
 * ESLint configuration for the auth package.
 *
 * Rules come from the shared tooling layer (`@abugida/eslint-config`); this
 * file adds the package's type-aware project.
 */
import base, { typescriptProject } from '@abugida/eslint-config'

export default [
  ...base,
  typescriptProject({
    files: [
      'src/**/*.ts',
      'src/**/*.tsx',
      'tests/**/*.ts',
      'tests/**/*.tsx',
      'examples/**/*.ts',
      'examples/**/*.tsx',
    ],
    project: ['./tsconfig.eslint.json'],
    tsconfigRootDir: import.meta.dirname,
  }),
]
