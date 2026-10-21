// @ts-check

/**
 * ESLint configuration for the tooling layer itself.
 *
 * The tooling packages are the shared configuration of the monorepo, so they
 * follow the same lint policy as the workspaces they configure. The rules
 * come from the shared base (`@abugida/eslint-config`); this file only binds
 * them to the tooling directory.
 *
 * The tooling layer is linted from the repository root with:
 *   eslint --config tooling/eslint.config.js tooling
 */
import base from '@abugida/eslint-config'

export default base
