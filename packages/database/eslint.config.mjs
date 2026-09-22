import { globalIgnores, tseslint, typescriptProject } from '@abugida/eslint-config'

export default tseslint.config({
  ignores: [...globalIgnores, 'drizzle/**', 'tests/**', 'examples/**', 'drizzle.config.ts'],
  files: ['**/*.ts'],
  ...typescriptProject({ project: true, tsconfigRootDir: import.meta.dirname }),
})
