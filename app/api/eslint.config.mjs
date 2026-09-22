import { globalIgnores, tseslint, typescriptProject } from '@abugida/eslint-config'

export default tseslint.config(
  { ignores: globalIgnores },
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
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
