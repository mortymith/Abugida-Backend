import tseslint from 'typescript-eslint'

export default tseslint.config({
  ignores: ['dist/**', 'drizzle/**', 'tests/**', 'examples/**', 'drizzle.config.ts'],
  files: ['**/*.ts'],
  extends: [...tseslint.configs.recommended],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
