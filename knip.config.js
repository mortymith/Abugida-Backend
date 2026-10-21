// Root Knip configuration. Knip runs from the repo root only (pnpm knip), so
// the configuration lives here rather than in a shared tooling package.
//
// Knip detects unused files, exports, and dependencies. The configuration
// below teaches Knip about the repository's framework entry points so
// dynamically referenced files are not reported as false positives:
//
// - TanStack Start: `server.mjs` (production server used by the Dockerfile),
//   `src/default-entry/*` (framework handler entry) and the generated route
//   tree.
// - `examples/**` in shared packages are standalone documentation snippets,
//   not application code — they are entry points for humans.
// - Library barrels that exist as public API surface (`packages/queue`
//   job definitions) are entries, not dead files.
//
// Runtime name-loaded dependencies (ESLint/Prettier plugins, commitlint
// extends) are invisible to static analysis and are listed in
// `ignoreDependencies` with the owner documented inline.
//
// Run via the root `pnpm knip`. Full `--include exports` triage is tracked
// as follow-up work (see tooling/README.md).
//
// KNIP_DISABLE_RAW_TRANSFER (set in the root package.json script) avoids
// oxc-parser's large raw-transfer buffer, which fails to allocate in
// memory-constrained environments (CI containers).
//
// @type {import('knip').KnipConfig}
const config = {
  ignore: ['**/*.gen.ts'],
  ignoreDependencies: [
    // Loaded by name at runtime from the root commitlint.config.js:
    '@commitlint/config-conventional',
    // Loaded by name from tooling/prettier-config (and root prettier):
    'prettier-plugin-astro',
  ],
  workspaces: {
    '.': {},
    'app/api': {
      entry: ['src/index.ts', 'eslint.config.mjs'],
    },
    'app/dashboard': {
      entry: [
        // TanStack Start production server (Dockerfile CMD) and framework
        // handler entry:
        'server.mjs',
        'src/default-entry/*.ts',
        'src/router.tsx',
        'src/routes/**/*.tsx',
        'src/styles.css',
        'eslint.config.js',
      ],
    },
    'app/marketing': {
      entry: ['server.mjs', 'src/pages/**/*.{astro,ts,tsx}', 'astro.config.mjs'],
    },
    'packages/auth': {
      entry: ['src/index.ts', 'examples/**/*.{ts,tsx}'],
    },
    'packages/database': {
      entry: ['index.ts', 'drizzle.config.ts', 'examples/**/*.{ts,tsx}'],
    },
    'packages/observability': {
      entry: ['src/index.ts', 'examples/**/*.{ts,tsx}'],
    },
    'packages/queue': {
      entry: ['src/index.ts', 'src/definitions/jobs.ts', 'examples/**/*.ts'],
    },
    'packages/storage': {
      entry: ['src/index.ts', 'examples/**/*.{ts,tsx}'],
    },
  },
}

export default config
