/**
 * Shared commitlint configuration for the Abugida monorepo.
 *
 * Extracted from the historical root `commitlint.config.js`. Consumed by the
 * root `commitlint.config.js`:
 *
 *   export { default } from '@abugida/commitlint-config'
 *
 * @commitlint/config-conventional is a real dependency of this package so
 * the extends resolution always finds it next to this config.
 *
 * `body-max-line-length` / `footer-max-line-length` are disabled (existing
 * repository decision) because generated PR/issue footers legitimately
 * exceed 100 characters.
 *
 * @type {import('@commitlint/types').UserConfig}
 */
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [0, 'always', Infinity],
    'footer-max-line-length': [0, 'always', Infinity],
  },
}

export default config
