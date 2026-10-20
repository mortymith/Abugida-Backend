/**
 * Shared lint-staged configuration for the Abugida monorepo.
 *
 * Extracted from the historical root `.lintstagedrc.json` so the pre-commit
 * pipeline has one source of truth. Consumed by the root
 * `lint-staged.config.js`:
 *
 *   export { default } from '@abugida/lint-staged-config'
 *
 * Notes:
 * - ESLint runs from the repo root against the root flat config, which
 *   consumes @abugida/eslint-config (base recommended rules).
 * - `shfmt` is a system binary (package manager / `go install`); it formats
 *   staged shell scripts in place, matching the repository's 2-space bash
 *   style.
 * @type {import('lint-staged').Configuration}
 */
const config = {
  '*.{js,mjs,cjs,ts,tsx,jsx}': ['eslint --fix --no-warn-ignored', 'prettier --write'],
  '*.astro': ['eslint --fix --no-warn-ignored', 'prettier --write'],
  '*.{sh,bash,ksh,zsh}': ['shfmt -w -i 2 -sr -ln bash'],
  '*.{json,jsonc,md,mdx,yaml,yml,css,scss,html,graphql}': ['prettier --write'],
}

export default config
