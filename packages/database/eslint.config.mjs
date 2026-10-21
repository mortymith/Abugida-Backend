import base, { typescriptProject } from '@abugida/eslint-config'

export default [
  ...base,
  {
    ignores: ['drizzle/**', 'tests/**', 'examples/**', 'drizzle.config.ts'],
  },
  ...typescriptProject({
    files: ['**/*.ts'],
    project: true,
    tsconfigRootDir: import.meta.dirname,
  }),
]
