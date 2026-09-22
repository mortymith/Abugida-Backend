import { globalIgnores, tseslint, typescriptProject } from '@abugida/eslint-config'

export default tseslint.config({
  ignores: [...globalIgnores, 'tests/**', 'examples/**'],
  files: ['**/*.ts'],
  ...typescriptProject({ project: true, tsconfigRootDir: import.meta.dirname }),
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
      },
    ],
  },
})
