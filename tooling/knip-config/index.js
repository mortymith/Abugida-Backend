/**
 * Shared Knip configuration for the Abugida monorepo.
 *
 * Knip detects unused files, exports, and dependencies. The configuration
 * below teaches Knip about the repository's framework entry points so
 * dynamically referenced files are not reported as false positives:
 *
 * - TanStack Start: `server.mjs` (production server used by the Dockerfile),
 *   `src/default-entry/*` (framework handler entry), the generated route
 *   tree, and the operational `scripts/*.ts` (run manually with `bun run`).
 * - `examples/**` in shared packages are standalone documentation snippets,
 *   not application code — they are entry points for humans.
 * - Library barrels that exist as public API surface (`packages/queue`
 *   job definitions) are entries, not dead files.
 *
 * Dependencies that are consumed as *files* (CLI configuration, `--config`
 * paths, `tsconfig` extends, `bunfig` preloads) are invisible to static
 * analysis and are listed in `ignoreDependencies` with the owner documented
 * inline.
 *
 * Run via the root `pnpm knip`.
 *
 * @type {import('knip').KnipConfig}
 */
const config = {
  // System binaries invoked from the root scripts. They are not npm
  // packages, so Knip cannot resolve them as dependencies.
  ignoreBinaries: ['editorconfig-checker', 'dotenv-linter', 'gitleaks'],
  // Binaries installed system-wide (shellcheck, hadolint, yamllint,
  // markdownlint) are resolved from PATH, not from a dependency.
  ignoreGlobalBinaries: true,
  // Intentional API aliases (e.g. `presignedGet` → `presignedDownload`) are
  // reported as "duplicate exports" even though both names are part of the
  // published surface.
  exclude: ['duplicates'],
  // Pending integrations: implemented, documented, and waiting for the
  // feature change that mounts them. Static analysis cannot know that the
  // work is scheduled.
  ignore: [
    'app/api/src/middleware/tenant.middleware.ts',
    'app/dashboard/src/features/students/students.resilience.ts',
    'app/dashboard/src/features/students/students.rule-deferral.ts',
  ],
  ignoreIssues: {
    // The API's modules, the dashboard's features, and the published
    // packages export their public surface by design: routes, schemas, and
    // types are consumed through barrels, route maps, the OpenAPI document,
    // or by downstream consumers of the published packages — not through an
    // import that static analysis can see.
    'app/api/src/**': ['exports', 'types'],
    'app/dashboard/src/**': ['exports', 'types'],
    'packages/*/src/**': ['exports', 'types'],
  },
  ignoreDependencies: [
    // Loaded by name at runtime from tooling/commitlint-config:
    '@commitlint/config-conventional',
    // Provides the `markdownlint` binary used by the root `lint:markdown`
    // script. The binary is referenced inside a pipeline, which Knip cannot
    // resolve to the package that ships it.
    'markdownlint-cli',
    // Root-only tooling configuration packages. They are consumed as config
    // *files* (CLI `--config` paths, `tsconfig` extends, `bunfig` preloads),
    // never imported, so static analysis cannot see them:
    '@abugida/cspell-config',
    '@abugida/dotenv-linter-config',
    '@abugida/editorconfig-checker-config',
    '@abugida/gitleaks-config',
    '@abugida/hadolint-config',
    '@abugida/knip-config',
    '@abugida/lint-staged-config',
    '@abugida/markdownlint-config',
    '@abugida/prettier-config',
    '@abugida/shellcheck-config',
    '@abugida/syncpack-config',
    '@abugida/typescript-config',
    '@abugida/yamllint-config',
  ],
  workspaces: {
    '.': {},
    'app/api': {
      entry: ['src/index.ts'],
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
        // Operational scripts (seed data, migrations) run with `bun run`:
        'scripts/*.ts',
      ],
    },
    'app/marketing': {
      entry: ['server.mjs', 'src/pages/**/*.{astro,ts,tsx}'],
    },
    'packages/auth': {
      entry: ['examples/**/*.{ts,tsx}'],
    },
    'packages/database': {
      entry: ['examples/**/*.{ts,tsx}'],
    },
    'packages/observability': {
      entry: ['examples/**/*.{ts,tsx}'],
    },
    'packages/queue': {
      entry: ['src/definitions/jobs.ts', 'examples/**/*.ts'],
      // `hono` is an optional peer dependency: the Hono integration is one
      // of several subpath exports, so consumers that do not use it must not
      // have to install it. Knip cannot tell an optional peer from a
      // missing dependency.
      ignoreDependencies: ['hono'],
    },
    'packages/storage': {
      entry: ['examples/**/*.{ts,tsx}'],
    },
  },
}

export default config
