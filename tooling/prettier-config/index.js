// @ts-check

/**
 * Shared Prettier configuration for the Abugida monorepo.
 *
 * One formatting policy for the whole repository. Every workspace owns a
 * `prettier.config.js` that re-exports this config, and repository-level
 * files (docs, tooling sources) are formatted with `--config` pointing
 * here — there is no root Prettier config.
 *
 * The Astro plugin is resolved to an absolute path on purpose: Prettier
 * resolves plugin names relative to the config file that declares them, and
 * this config is consumed from many directories (workspaces, the repository
 * root, lint-staged). An absolute path keeps the plugin resolvable
 * everywhere while it stays a dependency of this package only.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** @type {import('prettier').Config} */
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
  plugins: [require.resolve('prettier-plugin-astro')],
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
