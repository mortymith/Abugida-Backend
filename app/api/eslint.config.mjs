import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['tests/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
