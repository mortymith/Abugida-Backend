// Root ESLint configuration is a thin consumer of the shared tooling layer.
// The actual rules live in tooling/eslint-config (framework-agnostic base).
// This root config backs lint-staged (pre-commit) and editor integration.
export { default } from '@abugida/eslint-config'
