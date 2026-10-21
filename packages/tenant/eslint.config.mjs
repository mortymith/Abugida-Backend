import base, { typescriptProject } from '@abugida/eslint-config'

export default [
  ...base,
  ...typescriptProject({
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    project: ['./tsconfig.eslint.json'],
    tsconfigRootDir: import.meta.dirname,
  }),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
]
