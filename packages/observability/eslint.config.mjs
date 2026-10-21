import base, { typescriptProject } from '@abugida/eslint-config'

export default [
  ...base,
  {
    ignores: ['tests/**', 'examples/**'],
  },
  ...typescriptProject({
    files: ['src/**/*.ts'],
    project: true,
    tsconfigRootDir: import.meta.dirname,
  }),
]
