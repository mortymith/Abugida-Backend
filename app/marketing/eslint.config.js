// eslint.config.js
import { globalIgnores } from '@abugida/eslint-config'
import eslintPluginAstro from 'eslint-plugin-astro'
import astroParser from 'astro-eslint-parser'
import typescriptParser from '@typescript-eslint/parser'

export default [
  // Shared monorepo ignores (dist, generated files, env files, ...).
  { ignores: globalIgnores },

  // Use the recommended rules from eslint-plugin-astro.
  ...eslintPluginAstro.configs.recommended,

  {
    // Configuration specifically for `.astro` files
    files: ['**/*.astro'],
    languageOptions: {
      // Use the Astro parser to understand `.astro` file syntax
      parser: astroParser,
      parserOptions: {
        // The Astro parser needs a TypeScript parser to handle script tags
        parser: typescriptParser,
        // Important: Tell the parser to treat `.astro` files as TypeScript
        extraFileExtensions: ['.astro'],
      },
    },
  },
]
