/**
 * Repository-level commitlint configuration for the Abugida monorepo.
 *
 * Owned by the repository root: commitlint discovers `commitlint.config.js`
 * in the working directory, so the husky `commit-msg` hook needs no
 * `--config` flag.
 *
 * @commitlint/config-conventional is a direct dependency of the root
 * package, so the `extends` resolution always finds it next to this config.
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
