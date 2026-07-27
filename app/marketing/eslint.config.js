// eslint.config.js
import eslintPluginAstro from 'eslint-plugin-astro';
// If you installed eslint-plugin-jsx-a11y
// import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import astroParser from 'astro-eslint-parser';
import typescriptParser from '@typescript-eslint/parser';

export default [
  // Use the recommended rules from eslint-plugin-astro.
  // Replace with 'jsx-a11y-recommended' if you installed the a11y plugin.
  ...eslintPluginAstro.configs.recommended, 
  // ...eslintPluginAstro.configs['jsx-a11y-recommended'],

  // If using the a11y plugin, you also need to add it to the plugins list:
  // {
  //   plugins: {
  //     "jsx-a11y": jsxA11yPlugin,
  //   },
  // },

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
  // You can add more generic rules here, e.g., for TypeScript files
  // {
  //   files: ['**/*.ts', '**/*.tsx'],
  //   rules: {
  //     // Your TypeScript-specific rules
  //   },
  // },
];
