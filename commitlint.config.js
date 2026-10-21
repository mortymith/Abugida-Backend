// Root commitlint configuration (git-hook tooling runs from the repo root
// only, so the policy lives here rather than in a shared tooling package).
//
// @commitlint/config-conventional is a root devDependency so the extends
// resolution finds it next to this config.
//
// `body-max-line-length` / `footer-max-line-length` are disabled (existing
// repository decision) because generated PR/issue footers legitimately
// exceed 100 characters.
//
// @type {import('@commitlint/types').UserConfig}
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [0, 'always', Infinity],
    'footer-max-line-length': [0, 'always', Infinity],
  },
}

export default config
