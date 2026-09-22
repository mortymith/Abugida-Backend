import { globalIgnores, tseslint } from '@abugida/eslint-config'

export default tseslint.config(
  { ignores: globalIgnores },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts'],
    rules: {
      // Severity stays `warn` to preserve the existing gate semantics for
      // this package; consolidating severities is tracked as follow-up work.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
  {
    // Explicit parser anchor: @typescript-eslint/parser refuses to infer a
    // tsconfig root when several candidates are registered in one process
    // (monorepo-wide lint-staged runs). parserOptions replace rather than
    // merge, so this block stays last.
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
)
