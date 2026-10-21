// @ts-check

/**
 * ESLint configuration for the Hono API.
 *
 * The rules come from the shared tooling layer (`@abugida/eslint-config`).
 * This file only adds the API's own type-aware projects: application code
 * and tests are checked against different tsconfigs.
 */
import base, { typescriptProject } from '@abugida/eslint-config'

export default [
  ...base,
  typescriptProject({
    files: ['src/**/*.ts'],
    project: './tsconfig.json',
    tsconfigRootDir: import.meta.dirname,
  }),
  typescriptProject({
    files: ['tests/**/*.ts'],
    project: './tsconfig.test.json',
    tsconfigRootDir: import.meta.dirname,
  }),
  {
    name: 'abugida/api/test-rules',
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
