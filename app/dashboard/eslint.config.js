//  @ts-check

/**
 * ESLint configuration for the TanStack Start dashboard.
 *
 * The dashboard owns the TanStack preset (framework specific rules live with
 * the framework that needs them). The shared repository policy — ignore
 * list and rule set — comes from `@abugida/eslint-config`.
 */
import { tanstackConfig } from '@tanstack/eslint-config'
import { globalIgnores, sharedRulesConfig } from '@abugida/eslint-config'

export default [
  { ignores: globalIgnores },
  ...tanstackConfig,
  sharedRulesConfig({
    // The TanStack preset already registers the `@typescript-eslint` plugin
    // for these file types; flat config refuses to register it twice.
    files: ['**/*.{js,ts,tsx}'],
    plugin: false,
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.name="process"][property.name="env"]',
          message:
            'Use the centralized env config from #/config/app.config.ts instead of process.env directly.',
        },
      ],
    },
  }),
  {
    name: 'abugida/dashboard/env-config-exception',
    files: ['src/config/app.config.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    name: 'abugida/dashboard/server-exception',
    files: ['server.mjs'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    name: 'abugida/dashboard/ignores',
    ignores: ['eslint.config.js', 'prettier.config.js'],
  },
]
