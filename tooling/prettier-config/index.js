// @ts-check

/**
 * Shared Prettier configuration for the Abugida monorepo.
 *
 * Extracted verbatim from the historical root `prettier.config.js` so every
 * consumer (root scripts, lint-staged, all workspaces) formats identically.
 * The Astro plugin lives here as a real dependency so the config is reusable
 * from any workspace without each one re-declaring the plugin.
 *
 * Consumed by the root `prettier.config.js`:
 *   export { default } from '@abugida/prettier-config'
 *
 * @type {import('prettier').Config}
 */
const config = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  plugins: ['prettier-plugin-astro'],
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
      },
    },
  ],
}

export default config
