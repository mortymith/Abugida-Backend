/**
 * Shared Bun test setup for the Abugida monorepo.
 *
 * Loaded via bunfig.toml `[test] preload` so every `bun test` invocation —
 * root, workspace, or CI — starts from the same, safe baseline. Keep this
 * framework-agnostic and app-agnostic: no database connections, no network,
 * no assumptions about which package is being tested.
 */

/**
 * Deterministic fallbacks for env the config validators require. Values are
 * only applied when unset, so a developer (or CI) providing real values
 * always wins. This makes a bare `bun test` work without exporting secrets
 * manually and guarantees no real credentials leak into test runs.
 */
const TEST_ENV_DEFAULTS = {
  BETTER_AUTH_SECRET: 'tooling-preload-test-secret-0123456789abcdef',
  BETTER_AUTH_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
} as const

for (const [key, value] of Object.entries(TEST_ENV_DEFAULTS)) {
  if (!process.env[key]) {
    process.env[key] = value
  }
}

// Wire shared custom matchers once per process.
import './matchers'

/**
 * Fail loudly if a test process is not running on Bun — the repository
 * standardizes on `bun test`, and vitest/jest-style globals would silently
 * produce different semantics.
 */
if (typeof Bun === 'undefined') {
  throw new Error('[bun-test-config] `bun test` is required — non-Bun runtimes are not supported.')
}
