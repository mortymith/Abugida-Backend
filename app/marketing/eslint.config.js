//  @ts-check

/**
 * ESLint configuration for the Astro marketing site.
 *
 * The shared repository policy comes from `@abugida/eslint-config`; the Astro
 * specific parser and plugin rules live here because only this workspace
 * knows about Astro.
 */
import base from '@abugida/eslint-config'
import eslintPluginAstro from 'eslint-plugin-astro'
import astroParser from 'astro-eslint-parser'
import typescriptParser from '@typescript-eslint/parser'

export default [
  ...base,
  // Use the recommended rules from eslint-plugin-astro.
  ...eslintPluginAstro.configs.recommended,
  {
    name: 'abugida/marketing/astro-parser',
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
